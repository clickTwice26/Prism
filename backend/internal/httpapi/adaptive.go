package httpapi

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"net/http"
	"strconv"
	"strings"

	"github.com/clickTwice26/Prism/backend/internal/adapt"
	"github.com/clickTwice26/Prism/backend/internal/ai"
	"github.com/clickTwice26/Prism/backend/internal/cache"
	"github.com/clickTwice26/Prism/backend/internal/gate"
	"github.com/clickTwice26/Prism/backend/internal/store"
	"github.com/clickTwice26/Prism/backend/internal/textkit"
)

// ---- review queue (N2) ----

func (s *Server) listReviews(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "pending"
	}
	if status != "pending" && status != "approved" && status != "rejected" {
		writeError(w, http.StatusUnprocessableEntity, "status must be pending, approved or rejected")
		return
	}
	items, err := s.db.ListReviews(r.Context(), status)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load reviews")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) reviewCount(w http.ResponseWriter, r *http.Request) {
	n, err := s.db.CountPendingReviews(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not count reviews")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"pending": n})
}

func (s *Server) decideReview(approve bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid id")
			return
		}
		var in struct {
			Output string `json:"output"`
		}
		if approve {
			if !decode(w, r, &in) || !textOK(w, in.Output, 20000) {
				return
			}
		}
		item, err := s.db.DecideReview(r.Context(), id, approve, strings.TrimSpace(in.Output))
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "no pending review with that id")
			return
		} else if err != nil {
			writeError(w, http.StatusInternalServerError, "could not save the decision")
			return
		}
		writeJSON(w, http.StatusOK, item)
	}
}

// ---- learners (N1) ----

func (s *Server) createLearner(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Code    string `json:"code"`
		Profile string `json:"profile"`
		Lang    string `json:"lang"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.Code = strings.TrimSpace(in.Code)
	if in.Lang == "" {
		in.Lang = "en"
	}
	switch {
	case in.Code == "" || len(in.Code) > 40:
		writeError(w, http.StatusUnprocessableEntity, "code is required (no real names)")
		return
	case !adapt.ValidProfile(in.Profile):
		writeError(w, http.StatusUnprocessableEntity, "profile must be one of: "+strings.Join(adapt.Profiles, ", "))
		return
	case !validLang(in.Lang):
		writeError(w, http.StatusUnprocessableEntity, "unsupported language")
		return
	}
	l, err := s.db.CreateLearner(r.Context(), store.Learner{Code: in.Code, Profile: in.Profile, Lang: in.Lang})
	if err != nil {
		writeError(w, http.StatusConflict, "could not add learner (is the code already used?)")
		return
	}
	writeJSON(w, http.StatusCreated, l)
}

func (s *Server) listLearners(w http.ResponseWriter, r *http.Request) {
	ls, err := s.db.ListLearners(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load learners")
		return
	}
	writeJSON(w, http.StatusOK, ls)
}

func (s *Server) learnerStats(ctx context.Context, id int64) (map[string][2]int, error) {
	rows, err := s.db.LearnerMixStats(ctx, id)
	if err != nil {
		return nil, err
	}
	stats := map[string][2]int{}
	for _, m := range rows {
		stats[m.Mix] = [2]int{m.Tries, m.Correct}
	}
	return stats, nil
}

// learnerInsights shows which support mixes work for one learner.
func (s *Server) learnerInsights(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	l, err := s.db.GetLearner(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "learner not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load learner")
		return
	}
	stats, err := s.learnerStats(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load results")
		return
	}
	arms := adapt.Arms(l.Profile, stats)
	answered := 0
	for _, a := range arms {
		answered += a.Tries
	}
	def := adapt.Default(l.Profile).Key()
	// Only claim a best mix once it has been tried a few times itself.
	confident := arms[0].Tries >= adapt.MinTriesForClaim
	writeJSON(w, http.StatusOK, map[string]any{
		"learner": l, "answered": answered, "default_mix": def, "best_mix": arms[0].Key,
		"confident": confident,
		// The layer-fit signal: does what works differ from what the diagnosis suggests?
		"differs_from_default": confident && arms[0].Key != def,
		"arms":                 arms,
	})
}

// ---- adaptive lesson (N1) ----

// prepareChunks cuts a lesson into chunks in the learner's language, each
// with one comprehension question, and stores them for reuse.
func (s *Server) prepareChunks(ctx context.Context, lesson store.Lesson, lang string) ([]store.Chunk, error) {
	if chunks, err := s.db.GetChunks(ctx, lesson.ID, lang); err != nil || len(chunks) > 0 {
		return chunks, err
	}
	if !s.ai.Enabled() {
		return nil, ai.ErrNotConfigured
	}
	parts := textkit.Chunks(lesson.Body, 40)
	chunks := make([]store.Chunk, 0, len(parts))
	for i, text := range parts {
		if lesson.Language != lang {
			tr, err := cache.Remember(ctx, s.cache, cache.Key("translate", lang, text), cacheTTL,
				func() (string, error) { return s.ai.Translate(ctx, text, lang) })
			if err != nil {
				return nil, err
			}
			text = tr
		}
		qs, err := s.ai.Quiz(ctx, text, lang, 1)
		if err != nil {
			return nil, err
		}
		if len(qs) == 0 || len(qs[0].Options) < 2 || qs[0].Answer < 0 || qs[0].Answer >= len(qs[0].Options) {
			return nil, fmt.Errorf("quiz: unusable question for chunk %d", i)
		}
		q := qs[0]
		chunks = append(chunks, store.Chunk{Idx: i, Text: text, Question: store.Question{Question: q.Question, Options: q.Options, Answer: q.Answer}})
	}
	if err := s.db.SaveChunks(ctx, lesson.ID, lang, chunks); err != nil {
		return nil, err
	}
	return chunks, nil
}

func (s *Server) nextChunk(w http.ResponseWriter, r *http.Request) {
	var in struct {
		LearnerID int64 `json:"learner_id"`
		LessonID  int64 `json:"lesson_id"`
		Chunk     int   `json:"chunk"`
	}
	if !decode(w, r, &in) {
		return
	}
	ctx := r.Context()
	learner, err := s.db.GetLearner(ctx, in.LearnerID)
	if err != nil {
		writeError(w, http.StatusNotFound, "learner not found")
		return
	}
	lesson, err := s.db.GetLesson(ctx, in.LessonID)
	if err != nil {
		writeError(w, http.StatusNotFound, "lesson not found")
		return
	}
	chunks, err := s.prepareChunks(ctx, lesson, learner.Lang)
	if err != nil {
		if errors.Is(err, ai.ErrNotConfigured) {
			writeError(w, http.StatusServiceUnavailable, "Adaptive lessons need AI to write the questions. Add a Gemini API key on the server.")
			return
		}
		s.aiError(w, err, "prepare the lesson")
		return
	}
	if in.Chunk < 0 || in.Chunk >= len(chunks) {
		writeError(w, http.StatusUnprocessableEntity, "chunk out of range")
		return
	}
	chunk := chunks[in.Chunk]

	stats, err := s.learnerStats(ctx, learner.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load results")
		return
	}
	rng := rand.New(rand.NewPCG(rand.Uint64(), rand.Uint64()))
	mix, reason := adapt.Choose(rng, learner.Profile, stats)

	// Sign is a real support only when there is something to sign: an
	// approved glossary sign in this part, or an interpreter for the lesson.
	// Otherwise record the mix the learner actually got.
	signs := []store.SignTerm{}
	var interpreter *store.SignVideo
	if mix.Sign {
		if signs, err = s.chunkSigns(ctx, chunk.Text, learner.Lang); err == nil {
			interpreter, err = s.db.LessonInterpreter(ctx, lesson.ID)
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load signs")
			return
		}
		if len(signs) == 0 && interpreter == nil {
			mix.Sign = false
			reason += " (no approved signs for this part yet)"
		}
	}

	text, verification := chunk.Text, gate.Verification("original")
	if mix.Simple {
		res, err := s.gate.Simplify(ctx, chunk.Text, learner.Lang)
		if err != nil {
			s.aiError(w, err, "simplify")
			return
		}
		text, verification = res.Text, res.Verification
	}
	attemptID, err := s.db.CreateAttempt(ctx, store.Attempt{LearnerID: learner.ID, LessonID: lesson.ID, ChunkIdx: chunk.Idx, Mix: mix.Key()}, reason)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start the chunk")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"attempt_id": attemptID, "chunk": chunk.Idx, "total_chunks": len(chunks),
		"mix": mix, "mix_key": mix.Key(), "reason": reason,
		"text": text, "original_text": chunk.Text, "verification": verification, "lang": learner.Lang,
		"signs": signs, "interpreter": interpreter,
		"question": map[string]any{"question": chunk.Question.Question, "options": chunk.Question.Options},
	})
}

func (s *Server) answerChunk(w http.ResponseWriter, r *http.Request) {
	var in struct {
		AttemptID int64 `json:"attempt_id"`
		Choice    int   `json:"choice"`
	}
	if !decode(w, r, &in) {
		return
	}
	ctx := r.Context()
	a, err := s.db.GetAttempt(ctx, in.AttemptID)
	if err != nil {
		writeError(w, http.StatusNotFound, "attempt not found")
		return
	}
	learner, err := s.db.GetLearner(ctx, a.LearnerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load learner")
		return
	}
	chunks, err := s.db.GetChunks(ctx, a.LessonID, learner.Lang)
	if err != nil || a.ChunkIdx >= len(chunks) {
		writeError(w, http.StatusInternalServerError, "could not load the question")
		return
	}
	q := chunks[a.ChunkIdx].Question
	correct := in.Choice == q.Answer
	if _, err := s.db.AnswerAttempt(ctx, a.ID, correct); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save the answer")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"correct": correct, "answer": q.Answer, "answer_text": q.Options[q.Answer],
		"done": a.ChunkIdx+1 >= len(chunks),
	})
}
