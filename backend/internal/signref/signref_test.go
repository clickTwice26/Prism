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

func TestLettersAndTemplatesAreLoaded(t *testing.T) {
	dir := t.TempDir()
	sec := filepath.Join(dir, "Sections", "19 অক্ষর (Letters)")
	if err := os.MkdirAll(sec, 0o755); err != nil {
		t.Fatal(err)
	}
	ka := `<sigml><hns_sign gloss="ক"><hamnosys_manual><hamfinger2/><hamextfingeru/><hampalmd/><hamshoulders/><hamnomotion/></hamnosys_manual></hns_sign></sigml>`
	if err := os.WriteFile(filepath.Join(sec, "ক.sigml"), []byte(ka), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(sec, "খ.sigml"), nil, 0o644); err != nil {
		t.Fatal(err)
	}
	idx := Load(dir)
	ts := idx.Templates("Letters", nil)
	if len(ts) != 1 || ts[0].Bangla != "ক" || ts[0].English != "" || !ts[0].Complete || ts[0].Signs[0].Actions[0].Kind != "hold" {
		t.Fatalf("letter template: %+v", ts)
	}
	if len(idx.Templates("", []string{"ক"})) != 1 || len(idx.Templates("", []string{"x"})) != 0 {
		t.Fatal("word filter")
	}
	if f := idx.Failures(); len(f) != 1 || f[0].Reason != "empty file" {
		t.Fatalf("failures: %+v", f)
	}
	if st := idx.Stats(); st.Files != 2 || st.Complete != 1 || st.Handshapes["finger2"] != 1 {
		t.Fatalf("stats: %+v", st)
	}
}

func TestBanglaNamesAreNormalised(t *testing.T) {
	dir := t.TempDir()
	sec := filepath.Join(dir, "Sections", "1 কাজ (Work)")
	if err := os.MkdirAll(sec, 0o755); err != nil {
		t.Fatal(err)
	}
	// "আসো" with ো written as two code points (ে + া).
	decomposed := "আসো (Come).sigml"
	sign := `<sigml><hns_sign><hamnosys_manual><hamfist/><hamextfingeru/><hampalml/><hamchest/></hamnosys_manual></hns_sign></sigml>`
	if err := os.WriteFile(filepath.Join(sec, decomposed), []byte(sign), 0o644); err != nil {
		t.Fatal(err)
	}
	idx := Load(dir)
	composed := "আসো"
	if ts := idx.Templates("", []string{composed}); len(ts) != 1 || ts[0].Bangla != composed {
		t.Fatalf("lookup by the composed form failed: %+v", ts)
	}
}
