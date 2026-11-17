package gate

import (
	"context"
	"testing"

	"github.com/clickTwice26/Prism/backend/internal/ai"
	"github.com/clickTwice26/Prism/backend/internal/store"
)

// fakeModel returns scripted answers in order.
type fakeModel struct {
	simplified []string
	checks     []ai.FactCheck
	samples    []string
	consensus  ai.Consensus
	fixes      [][]string
}

func (f *fakeModel) Simplify(_ context.Context, _, _ string, fix []string) (string, error) {
	f.fixes = append(f.fixes, fix)
	out := f.simplified[0]
	f.simplified = f.simplified[1:]
	return out, nil
}

func (f *fakeModel) CheckFacts(context.Context, string, string) (ai.FactCheck, error) {
	out := f.checks[0]
	f.checks = f.checks[1:]
	return out, nil
}

func (f *fakeModel) DescribeImageSamples(context.Context, string, string, string, int) ([]string, error) {
	return f.samples, nil
}

func (f *fakeModel) Consensus(context.Context, []string, string) (ai.Consensus, error) {
	return f.consensus, nil
}

type memRepo struct {
	verified map[string]store.VerifiedLayer
	reviews  []store.ReviewItem
}

func newRepo() *memRepo { return &memRepo{verified: map[string]store.VerifiedLayer{}} }

func key(kind, lang, variant, hash string) string {
	return kind + "|" + lang + "|" + variant + "|" + hash
}

func (m *memRepo) GetVerified(_ context.Context, kind, lang, variant, hash string) (*store.VerifiedLayer, error) {
	if v, ok := m.verified[key(kind, lang, variant, hash)]; ok {
		return &v, nil
	}
	return nil, nil
}

func (m *memRepo) SaveVerified(_ context.Context, kind, lang, variant, hash, output, source string) error {
	m.verified[key(kind, lang, variant, hash)] = store.VerifiedLayer{Output: output, Source: source}
	return nil
}

func (m *memRepo) OpenReview(_ context.Context, kind, lang, variant, hash string) (*store.ReviewItem, error) {
	for i := range m.reviews {
		r := m.reviews[i]
		if r.Kind == kind && r.Lang == lang && r.Variant == variant && r.InputHash == hash && r.Status == "pending" {
			return &r, nil
		}
	}
	return nil, nil
}

func (m *memRepo) QueueReview(_ context.Context, r store.ReviewItem) (store.ReviewItem, error) {
	r.ID = int64(len(m.reviews) + 1)
	r.Status = "pending"
	m.reviews = append(m.reviews, r)
	return r, nil
}

var on = func() bool { return true }

const original = "Plants turn sunlight, water and carbon dioxide into glucose and oxygen."

func TestSimplifyPassesFirstTime(t *testing.T) {
	m := &fakeModel{simplified: []string{"Plants make food from light."}, checks: []ai.FactCheck{{Faithful: true}}}
	repo := newRepo()
	res, err := New(m, repo, on).Simplify(context.Background(), original, "en")
	if err != nil || res.Verification != AutoVerified || res.Repaired {
		t.Fatalf("got %+v, %v", res, err)
	}
	// Second call is served from the verified store without calling the model.
	again, _ := New(&fakeModel{}, repo, on).Simplify(context.Background(), original, "en")
	if again.Text != res.Text || again.Verification != AutoVerified {
		t.Fatalf("expected stored layer, got %+v", again)
	}
}

func TestSimplifyRepairsWithNamedIssues(t *testing.T) {
	m := &fakeModel{
		simplified: []string{"Plants make sugar.", "Plants use light, water and carbon dioxide to make glucose and oxygen."},
		checks:     []ai.FactCheck{{Faithful: false, Issues: []string{"Dropped oxygen"}}, {Faithful: true}},
	}
	res, err := New(m, newRepo(), on).Simplify(context.Background(), original, "en")
	if err != nil || res.Verification != AutoVerified || !res.Repaired {
		t.Fatalf("got %+v, %v", res, err)
	}
	if len(m.fixes) != 2 || len(m.fixes[1]) != 1 || m.fixes[1][0] != "Dropped oxygen" {
		t.Fatalf("second rewrite should be told the issue, got %v", m.fixes)
	}
}

func TestSimplifyFailingTwiceGoesToTeacherAndShowsOriginal(t *testing.T) {
	m := &fakeModel{
		simplified: []string{"Plants eat soil.", "Plants eat soil and light."},
		checks:     []ai.FactCheck{{Faithful: false, Issues: []string{"Added: soil"}}, {Faithful: false, Issues: []string{"Added: soil"}}},
	}
	repo := newRepo()
	res, err := New(m, repo, on).Simplify(context.Background(), original, "en")
	if err != nil || res.Verification != PendingReview || res.Text != original || res.ReviewID == 0 {
		t.Fatalf("learner must see the original while pending, got %+v, %v", res, err)
	}
	if len(repo.reviews) != 1 || repo.reviews[0].AIOutput != "Plants eat soil and light." {
		t.Fatalf("expected one review item, got %+v", repo.reviews)
	}
	// While pending, no new AI calls and the safe text is served.
	again, _ := New(&fakeModel{}, repo, on).Simplify(context.Background(), original, "en")
	if again.Verification != PendingReview || again.Text != original {
		t.Fatalf("got %+v", again)
	}
}

func TestSimplifyOfflineUsesRules(t *testing.T) {
	res, err := New(&fakeModel{}, newRepo(), func() bool { return false }).Simplify(context.Background(), "We utilize water.", "en")
	if err != nil || res.Verification != RulesOnly || res.Text != "We use water." {
		t.Fatalf("got %+v, %v", res, err)
	}
}

func TestDescribeHoldsBackDisputedDetails(t *testing.T) {
	m := &fakeModel{
		samples:   []string{"A cell with a nucleus and 4 chloroplasts.", "A cell with a nucleus and 6 chloroplasts.", "A cell with a nucleus."},
		consensus: ai.Consensus{Description: "A plant cell with a nucleus.", Disputed: []string{"number of chloroplasts"}},
	}
	repo := newRepo()
	res, err := New(m, repo, on).Describe(context.Background(), "data:image/png;base64,AA", "en", "short")
	if err != nil || res.Verification != PendingReview || res.Description != "A plant cell with a nucleus." || res.Disputed != 1 {
		t.Fatalf("got %+v, %v", res, err)
	}
	if len(repo.reviews) != 1 || repo.reviews[0].SafeOutput != "A plant cell with a nucleus." {
		t.Fatalf("expected review with safe consensus, got %+v", repo.reviews)
	}
}

func TestDescribeAgreementIsAutoVerified(t *testing.T) {
	m := &fakeModel{samples: []string{"A", "A", "A"}, consensus: ai.Consensus{Description: "A leaf.", Disputed: []string{}}}
	res, err := New(m, newRepo(), on).Describe(context.Background(), "data:image/png;base64,AA", "en", "short")
	if err != nil || res.Verification != AutoVerified || res.Description != "A leaf." {
		t.Fatalf("got %+v, %v", res, err)
	}
}

func TestTeacherApprovalIsServed(t *testing.T) {
	repo := newRepo()
	_ = repo.SaveVerified(context.Background(), "describe", "bn", "short", Hash("img"), "শিক্ষকের বর্ণনা", "teacher")
	res, _ := New(&fakeModel{}, repo, on).Describe(context.Background(), "img", "bn", "short")
	if res.Verification != TeacherVerified || res.Description != "শিক্ষকের বর্ণনা" {
		t.Fatalf("got %+v", res)
	}
}
