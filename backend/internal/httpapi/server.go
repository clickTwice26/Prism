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
	"github.com/clickTwice26/Prism/backend/internal/live"
	"github.com/clickTwice26/Prism/backend/internal/signref"
	"github.com/clickTwice26/Prism/backend/internal/store"
)

type Server struct {
	cfg   config.Config
	db    *store.Store
	cache *cache.Cache
	ai    *ai.Client
	hub   *live.Hub
	log   *slog.Logger

	signRef *signref.Index
}

func New(cfg config.Config, db *store.Store, c *cache.Cache, aic *ai.Client, hub *live.Hub, log *slog.Logger) *Server {
	ref := signref.Load(cfg.SignReferenceDir)
	if ref.Size() > 0 {
		st := ref.Stats()
		log.Info("sign reference loaded", "files", st.Files, "templates", st.Parsed, "complete", st.Complete, "failed", st.Failed)
	}
	return &Server{cfg: cfg, db: db, cache: c, ai: aic, hub: hub, log: log, signRef: ref}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", s.health)

	mux.HandleFunc("GET /api/lessons", s.listLessons)
	mux.HandleFunc("GET /api/lessons/{id}", s.getLesson)
	mux.HandleFunc("POST /api/lessons", s.createLesson)

	mux.Handle("POST /api/translate", s.limited(s.translate))

	mux.HandleFunc("POST /api/usage", s.logUsage)
	mux.HandleFunc("GET /api/usage/summary", s.usageSummary)

	// Prism Sign (Bangla Sign Language).
	mux.HandleFunc("GET /api/sign/lessons/{id}", s.getLessonSigns)
	mux.Handle("POST /api/sign/lessons/{id}/terms/extract", s.limited(s.extractTerms))
	mux.HandleFunc("POST /api/sign/lessons/{id}/terms", s.addLessonTerm)
	mux.HandleFunc("DELETE /api/sign/lessons/{id}/terms/{term}", s.removeLessonTerm)
	mux.HandleFunc("GET /api/sign/lexicon", s.signLexicon)
	mux.HandleFunc("GET /api/sign/missing", s.missingSigns)
	mux.HandleFunc("GET /api/sign/reference", s.signReference)
	mux.HandleFunc("GET /api/sign/templates", s.signTemplates)
	mux.HandleFunc("POST /api/sign/samples", s.createSignSample)
	mux.HandleFunc("GET /api/sign/samples", s.listSignSamples)
	mux.HandleFunc("DELETE /api/sign/samples/{id}", s.deleteSignSample)
	mux.HandleFunc("POST /api/sign/videos", s.uploadSignVideo)
	mux.HandleFunc("GET /api/sign/videos", s.listSignVideos)
	mux.HandleFunc("GET /api/sign/videos/count", s.signVideoCount)
	mux.HandleFunc("POST /api/sign/videos/{id}/approve", s.decideSignVideo(true))
	mux.HandleFunc("POST /api/sign/videos/{id}/reject", s.decideSignVideo(false))
	mux.HandleFunc("POST /api/sign/videos/{id}/withdraw", s.withdrawSignVideo)
	mux.HandleFunc("GET /api/sign/media/{file}", s.signMedia)

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
			h.Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
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

const maxBody = 1 << 20 // JSON bodies are small; videos use multipart uploads

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
