package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ---- Verified layers (N2) ----

type VerifiedLayer struct {
	Output string
	Source string // auto | teacher
}

func (s *Store) GetVerified(ctx context.Context, kind, lang, variant, hash string) (*VerifiedLayer, error) {
	var v VerifiedLayer
	err := s.Pool.QueryRow(ctx, `SELECT output, source FROM verified_layers
		WHERE kind=$1 AND lang=$2 AND variant=$3 AND input_hash=$4`, kind, lang, variant, hash).Scan(&v.Output, &v.Source)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &v, err
}

// SaveVerified stores a checked output. A teacher approval always wins over an
// automatic one; an automatic save never overwrites a teacher's.
func (s *Store) SaveVerified(ctx context.Context, kind, lang, variant, hash, output, source string) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO verified_layers(kind, lang, variant, input_hash, output, source)
		VALUES($1,$2,$3,$4,$5,$6)
		ON CONFLICT (kind, lang, variant, input_hash) DO UPDATE
		SET output = EXCLUDED.output, source = EXCLUDED.source, created_at = now()
		WHERE verified_layers.source = 'auto' OR EXCLUDED.source = 'teacher'`,
		kind, lang, variant, hash, output, source)
	return err
}

// ---- Review queue (N2) ----

type ReviewItem struct {
	ID          int64      `json:"id"`
	Kind        string     `json:"kind"`
	Lang        string     `json:"lang"`
	Variant     string     `json:"variant"`
	InputHash   string     `json:"-"`
	InputText   string     `json:"input_text"`
	InputImage  string     `json:"input_image"`
	AIOutput    string     `json:"ai_output"`
	SafeOutput  string     `json:"safe_output"`
	Issues      []string   `json:"issues"`
	Status      string     `json:"status"`
	FinalOutput *string    `json:"final_output"`
	CreatedAt   time.Time  `json:"created_at"`
	ReviewedAt  *time.Time `json:"reviewed_at"`
}

const reviewCols = `id, kind, lang, variant, input_hash, input_text, input_image, ai_output, safe_output,
	issues, status, final_output, created_at, reviewed_at`

func scanReview(row pgx.Row) (ReviewItem, error) {
	var r ReviewItem
	var issues []byte
	err := row.Scan(&r.ID, &r.Kind, &r.Lang, &r.Variant, &r.InputHash, &r.InputText, &r.InputImage, &r.AIOutput,
		&r.SafeOutput, &issues, &r.Status, &r.FinalOutput, &r.CreatedAt, &r.ReviewedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return r, ErrNotFound
	}
	if err == nil {
		err = json.Unmarshal(issues, &r.Issues)
	}
	if r.Issues == nil {
		r.Issues = []string{}
	}
	return r, err
}

// OpenReview returns the pending review item for an input, if any.
func (s *Store) OpenReview(ctx context.Context, kind, lang, variant, hash string) (*ReviewItem, error) {
	r, err := scanReview(s.Pool.QueryRow(ctx, `SELECT `+reviewCols+` FROM review_items
		WHERE kind=$1 AND lang=$2 AND variant=$3 AND input_hash=$4 AND status='pending'`, kind, lang, variant, hash))
	if errors.Is(err, ErrNotFound) {
		return nil, nil
	}
	return &r, err
}

// QueueReview adds an item, or returns the existing open one for that input.
func (s *Store) QueueReview(ctx context.Context, r ReviewItem) (ReviewItem, error) {
	issues, _ := json.Marshal(r.Issues)
	out, err := scanReview(s.Pool.QueryRow(ctx, `INSERT INTO review_items
		(kind, lang, variant, input_hash, input_text, input_image, ai_output, safe_output, issues)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (kind, lang, variant, input_hash) WHERE status = 'pending' DO NOTHING
		RETURNING `+reviewCols,
		r.Kind, r.Lang, r.Variant, r.InputHash, r.InputText, r.InputImage, r.AIOutput, r.SafeOutput, issues))
	if errors.Is(err, ErrNotFound) {
		existing, err := s.OpenReview(ctx, r.Kind, r.Lang, r.Variant, r.InputHash)
		if err != nil || existing == nil {
			return out, err
		}
		return *existing, nil
	}
	return out, err
}

func (s *Store) ListReviews(ctx context.Context, status string) ([]ReviewItem, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+reviewCols+` FROM review_items WHERE status=$1 ORDER BY created_at`, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ReviewItem{}
	for rows.Next() {
		r, err := scanReview(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) CountPendingReviews(ctx context.Context) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM review_items WHERE status='pending'`).Scan(&n)
	return n, err
}

// DecideReview closes a pending item. Approving stores the teacher's text as
// the verified layer for that input, inside the same transaction.
func (s *Store) DecideReview(ctx context.Context, id int64, approve bool, final string) (ReviewItem, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return ReviewItem{}, err
	}
	defer tx.Rollback(ctx)

	status := "rejected"
	var finalPtr *string
	if approve {
		status, finalPtr = "approved", &final
	}
	r, err := scanReview(tx.QueryRow(ctx, `UPDATE review_items SET status=$2, final_output=$3, reviewed_at=now()
		WHERE id=$1 AND status='pending' RETURNING `+reviewCols, id, status, finalPtr))
	if err != nil {
		return r, err
	}
	if approve {
		if _, err := tx.Exec(ctx, `INSERT INTO verified_layers(kind, lang, variant, input_hash, output, source)
			VALUES($1,$2,$3,$4,$5,'teacher')
			ON CONFLICT (kind, lang, variant, input_hash) DO UPDATE
			SET output = EXCLUDED.output, source = 'teacher', created_at = now()`,
			r.Kind, r.Lang, r.Variant, r.InputHash, final); err != nil {
			return r, err
		}
	}
	return r, tx.Commit(ctx)
}
