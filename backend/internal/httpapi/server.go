// Package httpapi exposes the REST API and the live-class WebSocket.
package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"runtime/debug"
	"slices"
	"strings"
	"time"

	"github.com/coder/websocket"

	"github.com/clickTwice26/Prism/backend/internal/ai"
	"github.com/clickTwice26/Prism/backend/internal/cache"
	"github.com/clickTwice26/Prism/backend/internal/config"
	"github.com/clickTwice26/Prism/backend/internal/gate"
	"github.com/clickTwice26/Prism/backend/internal/live"
	"github.com/clickTwice26/Prism/backend/internal/store"
	"github.com/clickTwice26/Prism/backend/internal/tts"
)

type Server struct {
	cfg   config.Config
	db    *store.Store
	cache *cache.Cache
	ai    *ai.Client
	gate  *gate.Gate
	piper *tts.Piper
	hub   *live.Hub
	log   *slog.Logger
}

func New(cfg config.Config, db *store.Store, c *cache.Cache, aic *ai.Client, piper *tts.Piper, hub *live.Hub, log *slog.Logger) *Server {
	return &Server{cfg: cfg, db: db, cache: c, ai: aic, gate: gate.New(aic, db, aic.Enabled), piper: piper, hub: hub, log: log}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", s.health)

	mux.HandleFunc("GET /api/lessons", s.listLessons)
	mux.HandleFunc("GET /api/lessons/{id}", s.getLesson)
	mux.HandleFunc("POST /api/lessons", s.createLesson)

	mux.Handle("POST /api/simplify", s.limited(s.simplify))
	mux.Handle("POST /api/quiz", s.limited(s.quiz))
	mux.Handle("POST /api/translate", s.limited(s.translate))
	mux.Handle("POST /api/describe-image", s.limited(s.describeImage))
	mux.Handle("POST /api/illustrate", s.limited(s.illustrate))
	mux.HandleFunc("GET /api/tts/languages", s.ttsLanguages)
	mux.Handle("POST /api/tts", s.limited(s.speak))

	mux.HandleFunc("POST /api/usage", s.logUsage)
	mux.HandleFunc("GET /api/usage/summary", s.usageSummary)

	mux.HandleFunc("POST /api/study/participants", s.createParticipant)
	mux.HandleFunc("GET /api/study/participants", s.listParticipants)
	mux.HandleFunc("POST /api/study/results", s.createResult)
	mux.HandleFunc("GET /api/study/results", s.listResults)
	mux.HandleFunc("GET /api/study/summary", s.studySummary)

	// N2: fidelity gate review queue.
	mux.HandleFunc("GET /api/review", s.listReviews)
	mux.HandleFunc("GET /api/review/count", s.reviewCount)
	mux.HandleFunc("POST /api/review/{id}/approve", s.decideReview(true))
	mux.HandleFunc("POST /api/review/{id}/reject", s.decideReview(false))

	// N1: comprehension-driven adaptive lessons.
	mux.HandleFunc("POST /api/learners", s.createLearner)
	mux.HandleFunc("GET /api/learners", s.listLearners)
	mux.HandleFunc("GET /api/learners/{id}/insights", s.learnerInsights)
	mux.Handle("POST /api/learn/next", s.limited(s.nextChunk))
	mux.HandleFunc("POST /api/learn/answer", s.answerChunk)

	mux.HandleFunc("GET /ws/class/{room}", s.liveClass)

	return s.recoverer(s.logRequests(s.cors(mux)))
}

// ---- middleware ----

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && s.originAllowed(origin) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Vary", "Origin")
			h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Content-Type")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// originAllowed accepts configured origins, plus localhost and private-LAN
// addresses so the app works when opened by IP from a phone on the same Wi-Fi.
func (s *Server) originAllowed(origin string) bool {
	if slices.Contains(s.cfg.CORSOrigins, origin) {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := u.Hostname()
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && (ip.IsLoopback() || ip.IsPrivate())
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int)        { w.status = code; w.ResponseWriter.WriteHeader(code) }
func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(sw, r)
		s.log.Info("http", "method", r.Method, "path", r.URL.Path, "status", sw.status, "ms", time.Since(start).Milliseconds())
	})
}

func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				s.log.Error("panic", "err", v, "stack", string(debug.Stack()))
				writeError(w, http.StatusInternalServerError, "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// limited applies the per-IP AI rate limit (backed by Redis).
func (s *Server) limited(h http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := s.cache.Allow(r.Context(), "ai:"+clientIP(r), s.cfg.AIRateLimitPerMin); err != nil {
			writeError(w, http.StatusTooManyRequests, "Too many requests. Please wait a minute and try again.")
			return
		}
		h(w, r)
	})
}

func clientIP(r *http.Request) string {
	if f := r.Header.Get("X-Forwarded-For"); f != "" {
		return strings.TrimSpace(strings.Split(f, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// ---- helpers ----

const maxBody = 12 << 20 // images arrive as data URLs

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "request too large")
		} else {
			writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		}
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// ---- live class ----

func (s *Server) liveClass(w http.ResponseWriter, r *http.Request) {
	room := r.PathValue("room")
	if !live.ValidRoom(room) {
		writeError(w, http.StatusBadRequest, "invalid class code")
		return
	}
	origin := r.Header.Get("Origin")
	if origin != "" && !s.originAllowed(origin) {
		writeError(w, http.StatusForbidden, "origin not allowed")
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true}) // origin checked above
	if err != nil {
		return
	}
	defer conn.CloseNow()
	s.hub.Serve(r.Context(), conn, room)
	conn.Close(websocket.StatusNormalClosure, "")
}
