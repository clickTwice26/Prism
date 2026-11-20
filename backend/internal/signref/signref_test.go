package signref

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadReadsBanglaAndEnglishFromFileNames(t *testing.T) {
	dir := t.TempDir()
	sec := filepath.Join(dir, "Sections", "14 শিক্ষা (Education)")
	if err := os.MkdirAll(sec, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, f := range []string{"বই (Book).sigml", "পানি (Water).sigml", "notes.txt"} {
		if err := os.WriteFile(filepath.Join(sec, f), []byte("<sigml/>"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	idx := Load(dir)
	if idx.Size() != 2 {
		t.Fatalf("want 2 words, got %d", idx.Size())
	}
	got := idx.Lookup(map[string]string{"en": "  water ", "bn": "পানি"})
	if len(got) != 1 || got[0].Bangla != "পানি" || got[0].English != "Water" || got[0].Section != "Education" {
		t.Fatalf("unexpected lookup %+v", got)
	}
	if len(idx.Lookup(map[string]string{"en": "chlorophyll"})) != 0 {
		t.Fatal("unknown word should not match")
	}
}

func TestMissingDirIsEmpty(t *testing.T) {
	if Load(filepath.Join(t.TempDir(), "nope")).Size() != 0 || Load("").Size() != 0 {
		t.Fatal("missing dir should give an empty index")
	}
}
