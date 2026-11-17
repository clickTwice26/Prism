package textkit

import (
	"strings"
	"testing"
)

func TestSimplifyKeepsDomainTerms(t *testing.T) {
	in := "Incident radiation is absorbed; consequently the surface warms."
	out := Simplify(in, "en")
	for _, term := range []string{"Incident", "radiation"} {
		if !strings.Contains(out, term) {
			t.Fatalf("domain term %q was changed: %q", term, out)
		}
	}
	if !strings.Contains(out, "So the surface warms.") {
		t.Fatalf("expected split and plain swap, got %q", out)
	}
}

func TestSimplifyLeavesOtherLanguages(t *testing.T) {
	in := "সালোকসংশ্লেষণ হলো একটি প্রক্রিয়া।"
	if got := Simplify(in, "bn"); got != in {
		t.Fatalf("bangla text changed: %q", got)
	}
}

func TestGradeLevelOnlyEnglish(t *testing.T) {
	if GradeLevel("The cat sat on the mat.", "en") == nil {
		t.Fatal("expected an English grade")
	}
	if GradeLevel("কিছু লেখা।", "bn") != nil {
		t.Fatal("expected nil grade for Bangla")
	}
}
