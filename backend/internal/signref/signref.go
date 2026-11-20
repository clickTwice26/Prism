// Package signref reads an existing Bangla Sign Language corpus so Prism can
// (1) tell reviewers when a term already has a documented sign, before anyone
// coins a new one, and (2) turn each documented sign into a template of its
// parts (handshape, orientation, location, movement) that a recogniser can
// check a live signer against. See docs/sign-recognition-plan.md.
//
// The corpus is IsharaKotha, laid out as
// <dir>/Sections/<n> <বাংলা> (<English>)/<বাংলা> (<English>).sigml, where each
// file describes a sign in HamNoSys notation. Prism never animates these
// descriptions as an avatar: it only reads their parts.
package signref

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/clickTwice26/Prism/backend/internal/store"
)

// Entry is one documented word.
type Entry struct {
	ID      string `json:"id"`
	Bangla  string `json:"bn"`
	English string `json:"en,omitempty"`
	Section string `json:"section"`
	Source  string `json:"source"`
}

// Template is a documented word with its signs broken into parts.
type Template struct {
	Entry
	Signs    []Sign `json:"signs"`
	Complete bool   `json:"complete"` // every sign has handshape, orientation and location
}

// Failure is a corpus file that could not be read.
type Failure struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

type Index struct {
	byNorm    map[string][]Entry
	templates map[string]*Template
	order     []string
	failures  []Failure
}

// name matches "বাংলা (English)" with an optional leading section number.
var name = regexp.MustCompile(`^(?:\d+\s+)?(.+?)\s*\(([^()]*)\)\s*$`)

func splitName(s string) (bn, en string) {
	s = store.CleanLabel(s)
	if m := name.FindStringSubmatch(s); m != nil {
		bn, en = strings.TrimSpace(m[1]), strings.TrimSpace(m[2])
	} else {
		bn = strings.TrimSpace(regexp.MustCompile(`^\d+\s+`).ReplaceAllString(s, ""))
	}
	if strings.EqualFold(en, "unknown") || strings.EqualFold(en, "sentence") {
		en = ""
	}
	return bn, en
}

// Load walks dir for .sigml files. A missing dir gives an empty index.
func Load(dir string) *Index {
	idx := &Index{byNorm: map[string][]Entry{}, templates: map[string]*Template{}}
	if dir == "" {
		return idx
	}
	if _, err := os.Stat(dir); err != nil {
		return idx
	}
	_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.EqualFold(filepath.Ext(path), ".sigml") {
			return nil
		}
		rel, _ := filepath.Rel(dir, path)
		e := Entry{ID: filepath.ToSlash(strings.TrimSuffix(rel, filepath.Ext(rel))), Source: "IsharaKotha"}
		e.Bangla, e.English = splitName(strings.TrimSuffix(d.Name(), filepath.Ext(d.Name())))
		secBn, secEn := splitName(filepath.Base(filepath.Dir(path)))
		e.Section = secEn
		if e.Section == "" {
			e.Section = secBn
		}
		idx.add(e)

		data, err := os.ReadFile(path)
		if err != nil {
			idx.failures = append(idx.failures, Failure{ID: e.ID, Reason: err.Error()})
			return nil
		}
		raws, err := readSigml(data)
		if err != nil {
			idx.failures = append(idx.failures, Failure{ID: e.ID, Reason: err.Error()})
			return nil
		}
		t := &Template{Entry: e, Complete: true}
		for _, r := range raws {
			s := ParseSign(r.Symbols, r.NonManual)
			t.Signs = append(t.Signs, s)
			t.Complete = t.Complete && s.Complete()
		}
		idx.templates[e.ID] = t
		idx.order = append(idx.order, e.ID)
		return nil
	})
	sort.Strings(idx.order)
	return idx
}

func (x *Index) add(e Entry) {
	seen := map[string]bool{}
	for _, k := range []string{store.NormTerm(e.Bangla), store.NormTerm(e.English)} {
		if k != "" && !seen[k] {
			seen[k] = true
			x.byNorm[k] = append(x.byNorm[k], e)
		}
	}
}

// Size is the number of documented words (corpus files).
func (x *Index) Size() int { return len(x.templates) + len(x.failures) }

// Lookup returns documented words matching any of the labels exactly
// (ignoring case and spacing).
func (x *Index) Lookup(labels map[string]string) []Entry {
	seen := map[string]bool{}
	out := []Entry{}
	for _, l := range labels {
		for _, e := range x.byNorm[store.NormTerm(l)] {
			if !seen[e.ID] {
				seen[e.ID] = true
				out = append(out, e)
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Bangla < out[j].Bangla })
	return out
}

// Templates returns parsed templates, optionally only those in a section or
// matching words (Bangla or English, ignoring case and spacing).
func (x *Index) Templates(section string, words []string) []*Template {
	want := map[string]bool{}
	for _, w := range words {
		if n := store.NormTerm(w); n != "" {
			want[n] = true
		}
	}
	out := []*Template{}
	for _, id := range x.order {
		t := x.templates[id]
		if section != "" && !strings.EqualFold(t.Section, section) {
			continue
		}
		if len(want) > 0 && !want[store.NormTerm(t.Bangla)] && !want[store.NormTerm(t.English)] {
			continue
		}
		out = append(out, t)
	}
	return out
}

// Failures lists corpus files that could not be read.
func (x *Index) Failures() []Failure { return x.failures }

// Stats summarises how much of the corpus became usable templates.
type Stats struct {
	Files        int            `json:"files"`
	Parsed       int            `json:"parsed"`
	Complete     int            `json:"complete"`
	Failed       int            `json:"failed"`
	Signs        int            `json:"signs"`
	MultiSign    int            `json:"multi_sign_words"`
	WithGaps     int            `json:"words_with_gaps"`
	NonManual    int            `json:"with_nonmanual"`
	Hands        map[string]int `json:"hands"`
	Handshapes   map[string]int `json:"handshapes"`
	ActionKinds  map[string]int `json:"action_kinds"`
	GapSymbols   map[string]int `json:"gap_symbols"`
	FailReasons  map[string]int `json:"fail_reasons"`
	BySection    map[string]int `json:"complete_by_section"`
	UniqueWords  int            `json:"unique_parsed_words"`
	CompleteWord int            `json:"unique_complete_words"`
}

func (x *Index) Stats() Stats {
	st := Stats{Hands: map[string]int{}, Handshapes: map[string]int{}, ActionKinds: map[string]int{},
		GapSymbols: map[string]int{}, FailReasons: map[string]int{}, BySection: map[string]int{}}
	words, completeWords := map[string]bool{}, map[string]bool{}
	for _, id := range x.order {
		t := x.templates[id]
		st.Parsed++
		w := store.NormTerm(t.Bangla)
		words[w] = true
		if t.Complete {
			st.Complete++
			completeWords[w] = true
			st.BySection[t.Section]++
		}
		st.Signs += len(t.Signs)
		if len(t.Signs) > 1 {
			st.MultiSign++
		}
		gaps := false
		for _, s := range t.Signs {
			st.Hands[s.Hands]++
			if s.Dominant.Shape != "" {
				st.Handshapes[s.Dominant.Shape]++
			}
			if s.NonManual {
				st.NonManual++
			}
			for _, a := range s.Actions {
				st.ActionKinds[a.Kind]++
			}
			for _, g := range s.Gaps {
				st.GapSymbols[g]++
				gaps = true
			}
		}
		if gaps {
			st.WithGaps++
		}
	}
	for _, f := range x.failures {
		st.FailReasons[f.Reason]++
	}
	st.Failed = len(x.failures)
	st.Files = st.Parsed + st.Failed
	st.UniqueWords = len(words)
	st.CompleteWord = len(completeWords)
	return st
}
