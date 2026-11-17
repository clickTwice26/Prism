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
	"github.com/clickTwice26/Prism/backend/internal/gate"
	"github.com/clickTwice26/Prism/backend/internal/store"
	"github.com/clickTwice26/Prism/backend/internal/textkit"
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
		"piper_languages": s.piper.Languages(),
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

// ---- simplify (through the fidelity gate, N2) ----

type simplifyResult struct {
	Original string `json:"original"`
	gate.SimplifyResult
	GradeBefore *int `json:"grade_before"`
	GradeAfter  *int `json:"grade_after"`
}

func (s *Server) simplify(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Text string `json:"text"`
		Lang string `json:"lang"`
	}
	if !decode(w, r, &in) || !textOK(w, in.Text, 20000) {
		return
	}
	if in.Lang == "" {
		in.Lang = "en"
	}
	if !validLang(in.Lang) {
		writeError(w, http.StatusUnprocessableEntity, "unsupported language")
		return
	}
	res, err := s.gate.Simplify(r.Context(), in.Text, in.Lang)
	if err != nil {
		s.aiError(w, err, "simplify")
		return
	}
	out := simplifyResult{
		Original: in.Text, SimplifyResult: res,
		GradeBefore: textkit.GradeLevel(in.Text, in.Lang), GradeAfter: textkit.GradeLevel(res.Text, in.Lang),
	}
	source := "ai"
	if res.Verification == gate.RulesOnly {
		source = "rules"
	}
	_ = s.db.LogSimplify(r.Context(), store.SimplifyLog{Language: in.Lang, Source: source, Original: in.Text,
		Simplified: res.Text, GradeBefore: out.GradeBefore, GradeAfter: out.GradeAfter})
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) quiz(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Text  string `json:"text"`
		Lang  string `json:"lang"`
		Count int    `json:"count"`
	}
	if !decode(w, r, &in) || !textOK(w, in.Text, 20000) {
		return
	}
	if in.Lang == "" {
		in.Lang = "en"
	}
	if in.Count < 1 || in.Count > 5 {
		in.Count = 3
	}
	qs, err := cache.Remember(r.Context(), s.cache, cache.Key("quiz", in.Lang, strconv.Itoa(in.Count), in.Text), cacheTTL,
		func() ([]ai.QuizQuestion, error) { return s.ai.Quiz(r.Context(), in.Text, in.Lang, in.Count) })
	if err != nil {
		s.aiError(w, err, "make questions")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"questions": qs})
}

// ---- translate ----

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

// ---- describe image (through the fidelity gate, N2) ----

func (s *Server) describeImage(w http.ResponseWriter, r *http.Request) {
	var in struct {
		ImageDataURL string `json:"image_data_url"`
		Lang         string `json:"lang"`
		Detail       string `json:"detail"` // short | detailed
	}
	if !decode(w, r, &in) {
		return
	}
	if !strings.HasPrefix(in.ImageDataURL, "data:image/") {
		writeError(w, http.StatusUnprocessableEntity, "image_data_url must be a data:image/ URL")
		return
	}
	if in.Lang == "" {
		in.Lang = "en"
	}
	if in.Detail != "detailed" {
		in.Detail = "short"
	}
	if !validLang(in.Lang) {
		writeError(w, http.StatusUnprocessableEntity, "unsupported language")
		return
	}
	res, err := s.gate.Describe(r.Context(), in.ImageDataURL, in.Lang, in.Detail)
	if err != nil {
		s.aiError(w, err, "describe the image")
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) illustrate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Text string `json:"text"`
	}
	if !decode(w, r, &in) || !textOK(w, in.Text, 2000) {
		return
	}
	out, err := cache.Remember(r.Context(), s.cache, cache.Key("illustrate", in.Text), cacheTTL,
		func() (string, error) { return s.ai.Illustrate(r.Context(), in.Text) })
	if err != nil {
		s.aiError(w, err, "draw a picture")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"image_data_url": out})
}

// ---- text to speech ----

func (s *Server) ttsLanguages(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"piper": s.piper.Languages(), "ai": s.ai.Enabled(), "ai_provider": s.ai.Provider()})
}

// speak picks Piper (offline) when it has a voice, else the AI provider. The browser's
// own speech synthesis is the client-side fallback when this returns an error.
func (s *Server) speak(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Text   string `json:"text"`
		Lang   string `json:"lang"`
		Engine string `json:"engine"` // auto | piper | ai
	}
	if !decode(w, r, &in) || !textOK(w, in.Text, 5000) {
		return
	}
	if in.Lang == "" {
		in.Lang = "en"
	}
	usePiper := in.Engine != "ai" && in.Engine != "openai" && s.piper.Supports(in.Lang)
	if in.Engine == "piper" && !usePiper {
		writeError(w, http.StatusUnprocessableEntity, "no offline voice for this language")
		return
	}
	var (
		audio []byte
		err   error
		mime  string
	)
	if usePiper {
		mime = "audio/wav"
		audio, err = s.piper.Synthesize(r.Context(), in.Text, in.Lang)
	} else {
		audio, mime, err = s.ai.Speech(r.Context(), in.Text, in.Lang)
	}
	if err != nil {
		s.aiError(w, err, "read aloud")
		return
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(audio)
}

// ---- usage ----

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

// ---- study ----

func (s *Server) createParticipant(w http.ResponseWriter, r *http.Request) {
	var in store.Participant
	if !decode(w, r, &in) {
		return
	}
	if in.Code == "" || in.Profile == "" {
		writeError(w, http.StatusUnprocessableEntity, "code and profile are required")
		return
	}
	p, err := s.db.CreateParticipant(r.Context(), in)
	if err != nil {
		writeError(w, http.StatusConflict, "could not add participant (is the code already used?)")
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (s *Server) listParticipants(w http.ResponseWriter, r *http.Request) {
	ps, err := s.db.ListParticipants(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load participants")
		return
	}
	writeJSON(w, http.StatusOK, ps)
}

func (s *Server) createResult(w http.ResponseWriter, r *http.Request) {
	var in store.Result
	if !decode(w, r, &in) {
		return
	}
	if in.ParticipantID == 0 || in.Feature == "" || (in.Condition != "with_tool" && in.Condition != "without_tool") {
		writeError(w, http.StatusUnprocessableEntity, "participant_id, feature and condition (with_tool|without_tool) are required")
		return
	}
	res, err := s.db.CreateResult(r.Context(), in)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "could not save result (check participant and value ranges)")
		return
	}
	writeJSON(w, http.StatusCreated, res)
}

func (s *Server) listResults(w http.ResponseWriter, r *http.Request) {
	rs, err := s.db.ListResults(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load results")
		return
	}
	writeJSON(w, http.StatusOK, rs)
}

func (s *Server) studySummary(w http.ResponseWriter, r *http.Request) {
	out, err := s.db.StudySummary(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load summary")
		return
	}
	writeJSON(w, http.StatusOK, out)
}
