// Package gate is Prism's fidelity gate (novelty N2): no AI-written fact
// reaches a learner unchecked.
//
//   - Simplify: the rewrite is fact-checked against the original. If it fails,
//     it is rewritten once with the problems named. If it still fails, a
//     teacher reviews it and the learner sees the original meanwhile.
//   - Describe: the image is described several times independently. Only
//     details all descriptions agree on reach the learner; disputed details go
//     to a teacher instead (Chen et al., 2025; Aljedaani et al., 2026).
//
// Outputs that pass, automatically or by teacher approval, are stored once and
// reused for every learner.
package gate

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/clickTwice26/Prism/backend/internal/ai"
	"github.com/clickTwice26/Prism/backend/internal/store"
	"github.com/clickTwice26/Prism/backend/internal/textkit"
)

// Verification tells the learner's screen how far an output can be trusted.
type Verification string

const (
	TeacherVerified Verification = "teacher_verified" // a teacher approved it
	AutoVerified    Verification = "auto_verified"    // passed the automatic checks
	PendingReview   Verification = "pending_review"   // failed them; learner sees the safe version
	RulesOnly       Verification = "rules"            // offline rules, no AI involved
)

// Model is the part of the AI client the gate needs.
type Model interface {
	Simplify(ctx context.Context, text, lang string, fix []string) (string, error)
	CheckFacts(ctx context.Context, original, simplified string) (ai.FactCheck, error)
	DescribeImageSamples(ctx context.Context, imageDataURL, lang, detail string, n int) ([]string, error)
	Consensus(ctx context.Context, descriptions []string, lang string) (ai.Consensus, error)
}

// Repo is the storage the gate needs.
type Repo interface {
	GetVerified(ctx context.Context, kind, lang, variant, hash string) (*store.VerifiedLayer, error)
	SaveVerified(ctx context.Context, kind, lang, variant, hash, output, source string) error
	OpenReview(ctx context.Context, kind, lang, variant, hash string) (*store.ReviewItem, error)
	QueueReview(ctx context.Context, r store.ReviewItem) (store.ReviewItem, error)
}

// Samples is how many independent image descriptions are compared.
const Samples = 3

type Gate struct {
	model   Model
	repo    Repo
	enabled func() bool
}

func New(model Model, repo Repo, enabled func() bool) *Gate {
	return &Gate{model: model, repo: repo, enabled: enabled}
}

func Hash(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}

// SimplifyResult is what a learner is shown.
type SimplifyResult struct {
	Text         string       `json:"simplified"`
	Verification Verification `json:"verification"`
	Repaired     bool         `json:"repaired"` // passed only after a second, corrected rewrite
	ReviewID     int64        `json:"review_id,omitempty"`
}

func (g *Gate) Simplify(ctx context.Context, text, lang string) (SimplifyResult, error) {
	hash := Hash(text)
	if v, err := g.repo.GetVerified(ctx, "simplify", lang, "", hash); err != nil {
		return SimplifyResult{}, err
	} else if v != nil {
		return SimplifyResult{Text: v.Output, Verification: sourceVerification(v.Source)}, nil
	}
	if open, err := g.repo.OpenReview(ctx, "simplify", lang, "", hash); err != nil {
		return SimplifyResult{}, err
	} else if open != nil {
		return SimplifyResult{Text: open.SafeOutput, Verification: PendingReview, ReviewID: open.ID}, nil
	}
	if !g.enabled() {
		return SimplifyResult{Text: textkit.Simplify(text, lang), Verification: RulesOnly}, nil
	}

	var issues []string
	for round := 0; round < 2; round++ {
		out, err := g.model.Simplify(ctx, text, lang, issues)
		if err != nil {
			return SimplifyResult{}, err
		}
		fc, err := g.model.CheckFacts(ctx, text, out)
		if err != nil {
			return SimplifyResult{}, err
		}
		if fc.Faithful && len(fc.Issues) == 0 {
			if err := g.repo.SaveVerified(ctx, "simplify", lang, "", hash, out, "auto"); err != nil {
				return SimplifyResult{}, err
			}
			return SimplifyResult{Text: out, Verification: AutoVerified, Repaired: round > 0}, nil
		}
		issues = nonEmpty(fc.Issues, "The simplified text changed a fact.")
		if round == 1 {
			// Still unfaithful: the teacher decides; the learner keeps the original.
			item, err := g.repo.QueueReview(ctx, store.ReviewItem{
				Kind: "simplify", Lang: lang, InputHash: hash, InputText: text,
				AIOutput: out, SafeOutput: text, Issues: issues,
			})
			if err != nil {
				return SimplifyResult{}, err
			}
			return SimplifyResult{Text: text, Verification: PendingReview, ReviewID: item.ID}, nil
		}
	}
	return SimplifyResult{}, fmt.Errorf("unreachable")
}

// DescribeResult is what a learner is shown.
type DescribeResult struct {
	Description  string       `json:"description"`
	Verification Verification `json:"verification"`
	Disputed     int          `json:"disputed"` // details held back for the teacher
	ReviewID     int64        `json:"review_id,omitempty"`
}

func (g *Gate) Describe(ctx context.Context, imageDataURL, lang, detail string) (DescribeResult, error) {
	hash := Hash(imageDataURL)
	if v, err := g.repo.GetVerified(ctx, "describe", lang, detail, hash); err != nil {
		return DescribeResult{}, err
	} else if v != nil {
		return DescribeResult{Description: v.Output, Verification: sourceVerification(v.Source)}, nil
	}
	if open, err := g.repo.OpenReview(ctx, "describe", lang, detail, hash); err != nil {
		return DescribeResult{}, err
	} else if open != nil {
		return DescribeResult{Description: open.SafeOutput, Verification: PendingReview, Disputed: len(open.Issues), ReviewID: open.ID}, nil
	}
	if !g.enabled() {
		return DescribeResult{}, ai.ErrNotConfigured
	}

	samples, err := g.model.DescribeImageSamples(ctx, imageDataURL, lang, detail, Samples)
	if err != nil {
		return DescribeResult{}, err
	}
	if len(samples) < 2 {
		return DescribeResult{}, fmt.Errorf("describe: need at least 2 samples, got %d", len(samples))
	}
	cons, err := g.model.Consensus(ctx, samples, lang)
	if err != nil {
		return DescribeResult{}, err
	}
	if len(cons.Disputed) == 0 {
		if err := g.repo.SaveVerified(ctx, "describe", lang, detail, hash, cons.Description, "auto"); err != nil {
			return DescribeResult{}, err
		}
		return DescribeResult{Description: cons.Description, Verification: AutoVerified}, nil
	}
	item, err := g.repo.QueueReview(ctx, store.ReviewItem{
		Kind: "describe", Lang: lang, Variant: detail, InputHash: hash, InputImage: imageDataURL,
		AIOutput: samples[0], SafeOutput: cons.Description, Issues: cons.Disputed,
	})
	if err != nil {
		return DescribeResult{}, err
	}
	return DescribeResult{Description: cons.Description, Verification: PendingReview, Disputed: len(cons.Disputed), ReviewID: item.ID}, nil
}

func sourceVerification(source string) Verification {
	if source == "teacher" {
		return TeacherVerified
	}
	return AutoVerified
}

func nonEmpty(xs []string, fallback string) []string {
	if len(xs) == 0 {
		return []string{fallback}
	}
	return xs
}
