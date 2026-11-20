package httpapi

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"time"
	"unicode/utf8"

	"github.com/clickTwice26/Prism/backend/internal/store"
)

// ---- recognition samples: hand skeleton points only, never video ----

const maxSampleBody = 4 << 20

type sampleHand struct {
	Side   string       `json:"side"` // left | right, as the camera reports it
	Points [][3]float64 `json:"points"`
}

type sampleFrame struct {
	T     float64      `json:"t"` // ms since the sample started
	Hands []sampleHand `json:"hands"`
	Body  [][3]float64 `json:"body,omitempty"` // 33 pose points, for signs placed on the body
}

func finite(xs ...float64) bool {
	for _, x := range xs {
		if math.IsNaN(x) || math.IsInf(x, 0) || math.Abs(x) > 1e4 {
			return false
		}
	}
	return true
}

func (s *Server) createSignSample(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxSampleBody)
	var in struct {
		Kind           string        `json:"kind"`
		Label          string        `json:"label"`
		Signer         string        `json:"signer"`
		Dominant       string        `json:"dominant"`
		Deaf           bool          `json:"deaf"`
		Consent        bool          `json:"consent"`
		Frames         []sampleFrame `json:"frames"`
		Features       [][]float64   `json:"features"`
		FeatureVersion int           `json:"feature_version"`
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&in); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "sample too large")
		} else {
			writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		}
		return
	}
	in.Label = store.CleanLabel(in.Label)
	signer, ok := shortText(in.Signer, 80)
	switch {
	case in.Kind != "letter" && in.Kind != "handshape" && in.Kind != "word":
		writeError(w, http.StatusUnprocessableEntity, "kind must be letter, handshape or word")
		return
	case in.Label == "" || utf8.RuneCountInString(in.Label) > 40:
		writeError(w, http.StatusUnprocessableEntity, "label is required (1-40 characters)")
		return
	case in.Kind == "letter" && len(s.signRef.Templates("Letters", []string{in.Label})) == 0:
		writeError(w, http.StatusUnprocessableEntity, "unknown letter")
		return
	case in.Kind == "word" && len(s.signRef.Templates("", []string{in.Label})) == 0:
		writeError(w, http.StatusUnprocessableEntity, "unknown word: it has no documented sign")
		return
	case !ok:
		writeError(w, http.StatusUnprocessableEntity, "signer name is required (1-80 characters)")
		return
	case !in.Consent:
		writeError(w, http.StatusUnprocessableEntity, "the signer must consent to this sample being stored")
		return
	case len(in.Frames) < 3 || len(in.Frames) > 300:
		writeError(w, http.StatusUnprocessableEntity, "a sample needs 3-300 frames")
		return
	case len(in.Features) != 0 && len(in.Features) != len(in.Frames):
		writeError(w, http.StatusUnprocessableEntity, "features must have one vector per frame")
		return
	}
	if in.Dominant == "" {
		in.Dominant = "right"
	}
	if in.Dominant != "right" && in.Dominant != "left" {
		writeError(w, http.StatusUnprocessableEntity, "dominant must be right or left")
		return
	}
	for _, f := range in.Frames {
		if len(f.Hands) > 2 || !finite(f.T) {
			writeError(w, http.StatusUnprocessableEntity, "each frame has at most two hands")
			return
		}
		if len(f.Body) != 0 && len(f.Body) != 33 {
			writeError(w, http.StatusUnprocessableEntity, "body needs 33 points")
			return
		}
		for _, p := range f.Body {
			if !finite(p[0], p[1], p[2]) {
				writeError(w, http.StatusUnprocessableEntity, "points must be finite numbers")
				return
			}
		}
		for _, h := range f.Hands {
			if len(h.Points) != 21 || (h.Side != "left" && h.Side != "right") {
				writeError(w, http.StatusUnprocessableEntity, "each hand needs a side and 21 points")
				return
			}
			for _, p := range h.Points {
				if !finite(p[0], p[1], p[2]) {
					writeError(w, http.StatusUnprocessableEntity, "points must be finite numbers")
					return
				}
			}
		}
	}
	for _, v := range in.Features {
		if len(v) > 512 || !finite(v...) {
			writeError(w, http.StatusUnprocessableEntity, "feature vectors must be at most 512 finite numbers")
			return
		}
	}
	frames, _ := json.Marshal(in.Frames)
	features, _ := json.Marshal(in.Features)
	if in.Features == nil {
		features = []byte("[]")
	}
	saved, err := s.db.CreateSignSample(r.Context(), store.SignSample{
		Kind: in.Kind, Label: in.Label, Signer: signer, Dominant: in.Dominant, Deaf: in.Deaf,
		ConsentAt: time.Now(), Frames: frames, Features: features, FeatureVersion: max(in.FeatureVersion, 1),
	})
	if err != nil {
		s.log.Error("save sample", "err", err)
		writeError(w, http.StatusInternalServerError, "could not save the sample")
		return
	}
	saved.Frames, saved.Features = nil, nil
	writeJSON(w, http.StatusCreated, saved)
}

// listSignSamples returns sample metadata, or with ?full=1 the frames and
// features too (for the Python training tools).
func (s *Server) listSignSamples(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	if kind == "" {
		kind = "letter"
	}
	out, err := s.db.ListSignSamples(r.Context(), kind, r.URL.Query().Get("full") == "1")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load samples")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) deleteSignSample(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	if err := s.db.DeleteSignSample(r.Context(), id); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "no sample with that id")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "could not delete the sample")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
