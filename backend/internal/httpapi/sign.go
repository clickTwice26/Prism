package httpapi

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/clickTwice26/Prism/backend/internal/ai"
	"github.com/clickTwice26/Prism/backend/internal/signref"
	"github.com/clickTwice26/Prism/backend/internal/store"
)

// ---- Prism Sign (N5): Bangla Sign Language glossary, interpreter window and
// community lexicon. AI only finds a lesson's key terms; people record every
// sign and deaf reviewers approve it before learners see it. ----

const (
	maxTermClip   = 15 << 20  // a 2-4 s silent clip is far smaller
	maxLessonClip = 400 << 20 // an interpreter's signed lesson
)

var mediaName = regexp.MustCompile(`^[a-f0-9]{32}\.(webm|mp4)$`)

func pathID(w http.ResponseWriter, r *http.Request, name string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid "+name)
		return 0, false
	}
	return id, true
}

func shortText(s string, max int) (string, bool) {
	s = strings.Join(strings.Fields(s), " ")
	return s, s != "" && utf8.RuneCountInString(s) <= max
}

// ---- lesson terms ----

type lessonSigns struct {
	LessonID    int64                     `json:"lesson_id"`
	Terms       []store.SignTerm          `json:"terms"`
	Signed      int                       `json:"signed"` // terms with an approved sign
	Interpreter *store.SignVideo          `json:"interpreter"`
	Pending     []store.SignVideo         `json:"pending_interpreter"`
	AI          bool                      `json:"ai"`
	Reference   map[int64][]signref.Entry `json:"reference"`
}

func (s *Server) loadLessonSigns(ctx context.Context, lessonID int64) (lessonSigns, error) {
	out := lessonSigns{LessonID: lessonID, AI: s.ai.Enabled(), Reference: map[int64][]signref.Entry{}, Pending: []store.SignVideo{}}
	terms, err := s.db.LessonTerms(ctx, lessonID)
	if err != nil {
		return out, err
	}
	out.Terms = terms
	for _, t := range terms {
		if len(t.Clips) > 0 {
			out.Signed++
		} else if ref := s.signRef.Lookup(t.Labels); len(ref) > 0 {
			out.Reference[t.ID] = ref
		}
	}
	if out.Interpreter, err = s.db.LessonInterpreter(ctx, lessonID); err != nil {
		return out, err
	}
	pending, err := s.db.ListSignVideos(ctx, "pending")
	if err != nil {
		return out, err
	}
	for _, v := range pending {
		if v.Kind == "lesson" && v.LessonID != nil && *v.LessonID == lessonID {
			out.Pending = append(out.Pending, v)
		}
	}
	return out, nil
}

func (s *Server) getLessonSigns(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	if _, err := s.db.GetLesson(r.Context(), id); err != nil {
		writeError(w, http.StatusNotFound, "lesson not found")
		return
	}
	out, err := s.loadLessonSigns(r.Context(), id)
	if err != nil {
		s.log.Error("lesson signs", "err", err)
		writeError(w, http.StatusInternalServerError, "could not load the lesson's signs")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// extractTerms asks AI for the lesson's key terms and adds them to the lesson.
func (s *Server) extractTerms(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	ctx := r.Context()
	lesson, err := s.db.GetLesson(ctx, id)
	if err != nil {
		writeError(w, http.StatusNotFound, "lesson not found")
		return
	}
	terms, err := s.ai.KeyTerms(ctx, lesson.Title+"\n\n"+lesson.Body, lesson.Language)
	if err != nil {
		if errors.Is(err, ai.ErrNotConfigured) {
			writeError(w, http.StatusServiceUnavailable, "Finding key terms needs AI. Add a Gemini API key on the server, or add the terms by hand.")
			return
		}
		s.aiError(w, err, "find the key terms")
		return
	}
	for _, t := range terms {
		termID, err := s.db.UpsertTerm(ctx, t)
		if err == nil {
			err = s.db.AddLessonTerm(ctx, id, termID, "ai")
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not save the key terms")
			return
		}
	}
	out, err := s.loadLessonSigns(ctx, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load the lesson's signs")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) addLessonTerm(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var in struct {
		Labels map[string]string `json:"labels"`
	}
	if !decode(w, r, &in) {
		return
	}
	labels := map[string]string{}
	for lang, label := range in.Labels {
		if !validLang(lang) {
			writeError(w, http.StatusUnprocessableEntity, "unsupported language "+lang)
			return
		}
		if strings.TrimSpace(label) == "" {
			continue
		}
		clean, ok := shortText(label, 60)
		if !ok {
			writeError(w, http.StatusUnprocessableEntity, "each label must be 1-60 characters")
			return
		}
		labels[lang] = clean
	}
	if len(labels) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "write the term in at least one language")
		return
	}
	ctx := r.Context()
	if _, err := s.db.GetLesson(ctx, id); err != nil {
		writeError(w, http.StatusNotFound, "lesson not found")
		return
	}
	termID, err := s.db.UpsertTerm(ctx, labels)
	if err == nil {
		err = s.db.AddLessonTerm(ctx, id, termID, "teacher")
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not add the term")
		return
	}
	out, err := s.loadLessonSigns(ctx, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load the lesson's signs")
		return
	}
	writeJSON(w, http.StatusCreated, out)
}

func (s *Server) removeLessonTerm(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	termID, ok := pathID(w, r, "term")
	if !ok {
		return
	}
	if err := s.db.RemoveLessonTerm(r.Context(), id, termID); err != nil {
		writeError(w, http.StatusInternalServerError, "could not remove the term")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- lexicon ----

func (s *Server) signLexicon(w http.ResponseWriter, r *http.Request) {
	terms, err := s.db.Lexicon(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load the sign lexicon")
		return
	}
	writeJSON(w, http.StatusOK, terms)
}

type missingSign struct {
	store.SignTerm
	Reference []signref.Entry `json:"reference"`
}

// missingSigns is the community's to-do list: lesson terms with no approved
// sign, with any existing dictionary entry to check before coining one.
func (s *Server) missingSigns(w http.ResponseWriter, r *http.Request) {
	terms, err := s.db.MissingSigns(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load missing signs")
		return
	}
	out := make([]missingSign, len(terms))
	for i, t := range terms {
		out[i] = missingSign{SignTerm: t, Reference: s.signRef.Lookup(t.Labels)}
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) signReference(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	writeJSON(w, http.StatusOK, map[string]any{
		"size": s.signRef.Size(), "matches": s.signRef.Lookup(map[string]string{"q": q}),
	})
}

// ---- sign videos ----

// sniffVideo accepts WebM and MP4 by their first bytes, whatever the browser
// claims, and returns the MIME type and file extension.
func sniffVideo(head []byte) (string, string, bool) {
	switch {
	case bytes.HasPrefix(head, []byte{0x1A, 0x45, 0xDF, 0xA3}):
		return "video/webm", "webm", true
	case len(head) >= 8 && string(head[4:8]) == "ftyp":
		return "video/mp4", "mp4", true
	}
	return "", "", false
}

func randomName(ext string) string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b) + "." + ext
}

// uploadSignVideo stores a recorded sign as pending. The signer must give
// consent for each clip; nothing is shown to learners before deaf review.
func (s *Server) uploadSignVideo(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxLessonClip+(1<<20))
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "video too large")
		} else {
			writeError(w, http.StatusBadRequest, "send the video as multipart form data")
		}
		return
	}
	defer r.MultipartForm.RemoveAll()

	v := store.SignVideo{Kind: r.FormValue("kind")}
	signer, ok := shortText(r.FormValue("signer"), 80)
	if !ok {
		writeError(w, http.StatusUnprocessableEntity, "signer name is required (1-80 characters)")
		return
	}
	v.Signer = signer
	v.Region, _ = shortText(r.FormValue("region"), 60)
	if r.FormValue("consent") != "yes" {
		writeError(w, http.StatusUnprocessableEntity, "the signer must consent to this clip being shown to learners")
		return
	}
	v.ConsentAt = time.Now()

	ctx := r.Context()
	limit := int64(maxLessonClip)
	switch v.Kind {
	case "term":
		id, err := strconv.ParseInt(r.FormValue("term_id"), 10, 64)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, "term_id is required")
			return
		}
		if ok, err := s.db.TermExists(ctx, id); err != nil || !ok {
			writeError(w, http.StatusNotFound, "term not found")
			return
		}
		v.TermID, limit = &id, maxTermClip
	case "lesson":
		id, err := strconv.ParseInt(r.FormValue("lesson_id"), 10, 64)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, "lesson_id is required")
			return
		}
		if _, err := s.db.GetLesson(ctx, id); err != nil {
			writeError(w, http.StatusNotFound, "lesson not found")
			return
		}
		v.LessonID = &id
	default:
		writeError(w, http.StatusUnprocessableEntity, "kind must be term or lesson")
		return
	}

	file, hdr, err := r.FormFile("video")
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "attach the video")
		return
	}
	defer file.Close()
	if hdr.Size > limit {
		writeError(w, http.StatusRequestEntityTooLarge, "video too large: a key-term clip should be 2-4 seconds")
		return
	}
	head := make([]byte, 12)
	n, _ := io.ReadFull(file, head)
	mime, ext, ok := sniffVideo(head[:n])
	if !ok {
		writeError(w, http.StatusUnsupportedMediaType, "upload a WebM or MP4 video")
		return
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		writeError(w, http.StatusInternalServerError, "could not read the video")
		return
	}

	if err := os.MkdirAll(s.cfg.SignMediaDir, 0o755); err != nil {
		s.log.Error("sign media dir", "err", err)
		writeError(w, http.StatusInternalServerError, "could not store the video")
		return
	}
	v.File, v.Mime = randomName(ext), mime
	path := filepath.Join(s.cfg.SignMediaDir, v.File)
	dst, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not store the video")
		return
	}
	v.Bytes, err = io.Copy(dst, file)
	if cerr := dst.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(path)
		writeError(w, http.StatusInternalServerError, "could not store the video")
		return
	}
	saved, err := s.db.CreateSignVideo(ctx, v)
	if err != nil {
		_ = os.Remove(path)
		writeError(w, http.StatusInternalServerError, "could not save the video")
		return
	}
	writeJSON(w, http.StatusCreated, saved)
}

func (s *Server) listSignVideos(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	if status == "" {
		status = "pending"
	}
	if status != "pending" && status != "approved" && status != "rejected" {
		writeError(w, http.StatusUnprocessableEntity, "status must be pending, approved or rejected")
		return
	}
	vs, err := s.db.ListSignVideos(r.Context(), status)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load sign videos")
		return
	}
	writeJSON(w, http.StatusOK, vs)
}

func (s *Server) signVideoCount(w http.ResponseWriter, r *http.Request) {
	n, err := s.db.CountPendingSignVideos(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not count sign videos")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"pending": n})
}

func (s *Server) removeMedia(file string) {
	if mediaName.MatchString(file) {
		_ = os.Remove(filepath.Join(s.cfg.SignMediaDir, file))
	}
}

// decideSignVideo records a deaf reviewer's decision. Reviewers are named:
// deaf people hold the final say on every sign. A rejected clip's file is
// deleted, since it shows the signer's face.
func (s *Server) decideSignVideo(approve bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := pathID(w, r, "id")
		if !ok {
			return
		}
		var in struct {
			Reviewer string `json:"reviewer"`
			Note     string `json:"note"`
		}
		if !decode(w, r, &in) {
			return
		}
		reviewer, ok := shortText(in.Reviewer, 80)
		if !ok {
			writeError(w, http.StatusUnprocessableEntity, "reviewer name is required")
			return
		}
		note, _ := shortText(in.Note, 1000)
		v, err := s.db.DecideSignVideo(r.Context(), id, approve, reviewer, note)
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "no pending sign video with that id")
			return
		} else if err != nil {
			writeError(w, http.StatusInternalServerError, "could not save the decision")
			return
		}
		if !approve {
			s.removeMedia(v.File)
		}
		writeJSON(w, http.StatusOK, v)
	}
}

// withdrawSignVideo lets a signer take a clip back at any time.
func (s *Server) withdrawSignVideo(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	v, err := s.db.WithdrawSignVideo(r.Context(), id)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "no sign video with that id")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not withdraw the video")
		return
	}
	s.removeMedia(v.File)
	writeJSON(w, http.StatusOK, v)
}

// signMedia serves a stored sign video. Names are random, so files never
// change and can be cached on the device after the first play.
func (s *Server) signMedia(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("file")
	if !mediaName.MatchString(name) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	path := filepath.Join(s.cfg.SignMediaDir, name)
	if _, err := os.Stat(path); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	mime := "video/webm"
	if strings.HasSuffix(name, ".mp4") {
		mime = "video/mp4"
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeFile(w, r, path)
}

// ---- adaptive lessons ----

// chunkSigns lists the approved glossary terms that appear in a chunk's text.
func (s *Server) chunkSigns(ctx context.Context, text, lang string) ([]store.SignTerm, error) {
	lex, err := s.db.Lexicon(ctx)
	if err != nil {
		return nil, err
	}
	lower := store.NormTerm(text)
	out := []store.SignTerm{}
	for _, t := range lex {
		if l := t.Labels[lang]; l != "" && strings.Contains(lower, store.NormTerm(l)) {
			out = append(out, t)
		}
	}
	return out, nil
}
