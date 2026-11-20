// Package signref indexes an existing Bangla Sign Language word list so
// Prism can tell reviewers when a term already has a documented sign, before
// anyone coins a new one (N5, "check the dictionary first").
//
// It reads only the file names of the IsharaKotha corpus, laid out as
// <dir>/Sections/<n> <বাংলা> (<English>)/<বাংলা> (<English>).sigml. The
// avatar animations themselves are not used: Prism shows only human signers.
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
	Bangla  string `json:"bn"`
	English string `json:"en"`
	Section string `json:"section"`
	Source  string `json:"source"`
}

type Index struct {
	byNorm map[string][]Entry
	size   int
}

// name matches "বাংলা (English)" with an optional leading section number.
var name = regexp.MustCompile(`^(?:\d+\s+)?(.+?)\s*\(([^()]*)\)\s*$`)

// Load walks dir for .sigml files. A missing dir gives an empty index.
func Load(dir string) *Index {
	idx := &Index{byNorm: map[string][]Entry{}}
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
		m := name.FindStringSubmatch(strings.TrimSuffix(d.Name(), filepath.Ext(d.Name())))
		if m == nil {
			return nil
		}
		e := Entry{Bangla: strings.TrimSpace(m[1]), English: strings.TrimSpace(m[2]), Source: "IsharaKotha"}
		if sm := name.FindStringSubmatch(filepath.Base(filepath.Dir(path))); sm != nil {
			e.Section = strings.TrimSpace(sm[2])
		}
		idx.add(e)
		return nil
	})
	return idx
}

func (x *Index) add(e Entry) {
	x.size++
	seen := map[string]bool{}
	for _, k := range []string{store.NormTerm(e.Bangla), store.NormTerm(e.English)} {
		if k != "" && !seen[k] {
			seen[k] = true
			x.byNorm[k] = append(x.byNorm[k], e)
		}
	}
}

func (x *Index) Size() int { return x.size }

// Lookup returns documented words matching any of the labels exactly
// (ignoring case and spacing).
func (x *Index) Lookup(labels map[string]string) []Entry {
	seen := map[Entry]bool{}
	out := []Entry{}
	for _, l := range labels {
		for _, e := range x.byNorm[store.NormTerm(l)] {
			if !seen[e] {
				seen[e] = true
				out = append(out, e)
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Bangla < out[j].Bangla })
	return out
}
