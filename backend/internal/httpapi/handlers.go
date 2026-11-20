package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/clickTwice26/Prism/backend/internal/ai"
	"github.com/clickTwice26/Prism/backend/internal/cache"
	"github.com/clickTwice26/Prism/backend/internal/store"
)

const cacheTTL = 7 * 24 * time.Hour

func validLang(l string) bool { _, ok := ai.Languages[l]; return ok }

func textOK(w http.ResponseWriter, text string, max int) bool {
	n := utf8.RuneCountInString(strings.TrimSpace(text))
	if n == 0 || n > max {
		writeError(w, http.StatusUnprocessableEntity, "text must be 1-"+strconv.Itoa(max)+" characters")
		return false
	}
	return true
}

func (s *Server) aiError(w http.ResponseWriter, err error, what string) {
	if errors.Is(err, ai.ErrNotConfigured) {
		writeError(w, http.StatusServiceUnavailable, "AI is not configured on this server")
		return
	}
	s.log.Error(what+" failed", "err", err)
	writeError(w, http.StatusBadGateway, "Could not "+what+" right now. Please try again.")
}

// ---- health ----

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	pg := s.db.Pool.Ping(ctx) == nil
	rd := s.cache.R.Ping(ctx).Err() == nil
	status := http.StatusOK
	if !pg || !rd {
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, map[string]any{
		"status":   map[bool]string{true: "ok", false: "degraded"}[pg && rd],
		"postgres": pg, "redis": rd, "ai": s.ai.Enabled(), "ai_provider": s.ai.Provider(),
		"sign_reference_words": s.signRef.Size(),
	})
}

// ---- lessons ----

func (s *Server) listLessons(w http.ResponseWriter, r *http.Request) {
	ls, err := s.db.ListLessons(r.Context())
	if err != nil {
		s.log.Error("list lessons", "err", err)
		writeError(w, http.StatusInternalServerError, "could not load lessons")
		return
	}
	writeJSON(w, http.StatusOK, ls)
}

func (s *Server) getLesson(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	l, err := s.db.GetLesson(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "lesson not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load lesson")
		return
	}
	writeJSON(w, http.StatusOK, l)
}

func (s *Server) createLesson(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Subject  string `json:"subject"`
		Title    string `json:"title"`
		Body     string `json:"body"`
		Language string `json:"language"`
	}
	if !decode(w, r, &in) {
		return
	}
	if in.Language == "" {
		in.Language = "en"
	}
	switch {
	case strings.TrimSpace(in.Title) == "":
		writeError(w, http.StatusUnprocessableEntity, "title is required")
		return
	case !validLang(in.Language):
		writeError(w, http.StatusUnprocessableEntity, "unsupported language")
		return
	case !textOK(w, in.Body, 50000):
		return
	}
	l, err := s.db.CreateLesson(r.Context(), store.Lesson{Subject: in.Subject, Title: in.Title, Body: in.Body, Language: in.Language})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not save lesson")
		return
	}
	writeJSON(w, http.StatusCreated, l)
}

// ---- translate ----

// translate puts lesson text or a caption into the learner's language, so
// glossary signs are found in the words they read.
func (s *Server) translate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Text       string `json:"text"`
		TargetLang string `json:"target_lang"`
	}
	if !decode(w, r, &in) || !textOK(w, in.Text, 5000) {
		return
	}
	if !validLang(in.TargetLang) {
		writeError(w, http.StatusUnprocessableEntity, "unsupported language")
		return
	}
	out, err := cache.Remember(r.Context(), s.cache, cache.Key("translate", in.TargetLang, in.Text), cacheTTL,
		func() (string, error) { return s.ai.Translate(r.Context(), in.Text, in.TargetLang) })
	if err != nil {
		s.aiError(w, err, "translate")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"original": in.Text, "translated": out, "target_lang": in.TargetLang})
}

// ---- usage ----

// logUsage records anonymous feature use, such as sign taps and the
// interpreter window being switched on, for the pilot's "Use" measure.
func (s *Server) logUsage(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Feature string         `json:"feature"`
		Action  string         `json:"action"`
		Meta    map[string]any `json:"meta"`
	}
	if !decode(w, r, &in) {
		return
	}
	if in.Feature == "" || in.Action == "" || len(in.Feature) > 40 || len(in.Action) > 60 {
		writeError(w, http.StatusUnprocessableEntity, "feature and action are required")
		return
	}
	if err := s.db.LogUsage(r.Context(), in.Feature, in.Action, in.Meta); err != nil {
		writeError(w, http.StatusInternalServerError, "could not log usage")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) usageSummary(w http.ResponseWriter, r *http.Request) {
	out, err := s.db.UsageSummary(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load usage")
		return
	}
	writeJSON(w, http.StatusOK, out)
}
