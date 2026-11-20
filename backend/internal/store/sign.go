package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/text/unicode/norm"
)

// ---- Prism Sign (N5) ----

// NormTerm is the matching form of a term label: Unicode NFC (Bangla vowel
// signs such as ো can be written as one code point or two), lower case,
// single spaces.
func NormTerm(s string) string {
	return strings.ToLower(strings.Join(strings.Fields(norm.NFC.String(s)), " "))
}

// CleanLabel trims a label, joins its spaces and puts it in Unicode NFC.
func CleanLabel(s string) string {
	return strings.Join(strings.Fields(norm.NFC.String(s)), " ")
}

// SignVideo is a recorded sign: a glossary clip for one term, or an
// interpreter's signed version of a whole lesson.
type SignVideo struct {
	ID         int64      `json:"id"`
	Kind       string     `json:"kind"` // term | lesson
	TermID     *int64     `json:"term_id"`
	LessonID   *int64     `json:"lesson_id"`
	File       string     `json:"file"`
	Mime       string     `json:"mime"`
	Bytes      int64      `json:"bytes"`
	Signer     string     `json:"signer"`
	Region     string     `json:"region"`
	ConsentAt  time.Time  `json:"consent_at"`
	Status     string     `json:"status"`
	Reviewer   *string    `json:"reviewer"`
	ReviewNote string     `json:"review_note"`
	CreatedAt  time.Time  `json:"created_at"`
	ReviewedAt *time.Time `json:"reviewed_at"`

	// Filled for the review queue so reviewers see what the sign is for.
	TermLabels  map[string]string `json:"term_labels,omitempty"`
	LessonTitle string            `json:"lesson_title,omitempty"`
}

const videoCols = `v.id, v.kind, v.term_id, v.lesson_id, v.file, v.mime, v.bytes, v.signer, v.region, v.consent_at,
	v.status, v.reviewer, v.review_note, v.created_at, v.reviewed_at`

func scanVideo(row pgx.Row, extra ...any) (SignVideo, error) {
	var v SignVideo
	dest := append([]any{&v.ID, &v.Kind, &v.TermID, &v.LessonID, &v.File, &v.Mime, &v.Bytes, &v.Signer, &v.Region,
		&v.ConsentAt, &v.Status, &v.Reviewer, &v.ReviewNote, &v.CreatedAt, &v.ReviewedAt}, extra...)
	err := row.Scan(dest...)
	if errors.Is(err, pgx.ErrNoRows) {
		return v, ErrNotFound
	}
	return v, err
}

// SignTerm is a concept with its labels, its approved clips (regional
// variants) and how many clips still wait for a deaf reviewer.
type SignTerm struct {
	ID      int64             `json:"id"`
	Labels  map[string]string `json:"labels"`
	Clips   []SignVideo       `json:"clips"`
	Pending int               `json:"pending"`
	Source  string            `json:"source,omitempty"`  // lesson terms: ai | teacher
	Lessons []string          `json:"lessons,omitempty"` // missing signs: where the term is used
}

// UpsertTerm finds the term any of the labels already names, or creates one,
// and adds the labels it does not have yet. It returns the term id.
func (s *Store) UpsertTerm(ctx context.Context, labels map[string]string) (int64, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var id int64
	for lang, label := range labels {
		err := tx.QueryRow(ctx, `SELECT term_id FROM sign_term_labels WHERE lang=$1 AND norm=$2`, lang, NormTerm(label)).Scan(&id)
		if err == nil {
			break
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return 0, err
		}
	}
	if id == 0 {
		if err := tx.QueryRow(ctx, `INSERT INTO sign_terms DEFAULT VALUES RETURNING id`).Scan(&id); err != nil {
			return 0, err
		}
	}
	for lang, label := range labels {
		label = CleanLabel(label)
		if label == "" {
			continue
		}
		// Skip a label another term already owns, or a language this term has.
		if _, err := tx.Exec(ctx, `INSERT INTO sign_term_labels(term_id, lang, label, norm) VALUES($1,$2,$3,$4)
			ON CONFLICT DO NOTHING`, id, lang, label, NormTerm(label)); err != nil {
			return 0, err
		}
	}
	return id, tx.Commit(ctx)
}

func (s *Store) AddLessonTerm(ctx context.Context, lessonID, termID int64, source string) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO lesson_sign_terms(lesson_id, term_id, position, source)
		VALUES($1, $2, (SELECT coalesce(max(position) + 1, 0) FROM lesson_sign_terms WHERE lesson_id=$1), $3)
		ON CONFLICT DO NOTHING`, lessonID, termID, source)
	return err
}

func (s *Store) RemoveLessonTerm(ctx context.Context, lessonID, termID int64) error {
	_, err := s.Pool.Exec(ctx, `DELETE FROM lesson_sign_terms WHERE lesson_id=$1 AND term_id=$2`, lessonID, termID)
	return err
}

// fillTerms loads labels, approved clips and pending counts for terms.
func (s *Store) fillTerms(ctx context.Context, terms []SignTerm) ([]SignTerm, error) {
	if len(terms) == 0 {
		return terms, nil
	}
	ids := make([]int64, len(terms))
	at := map[int64]int{}
	for i := range terms {
		ids[i] = terms[i].ID
		at[terms[i].ID] = i
		terms[i].Labels = map[string]string{}
		terms[i].Clips = []SignVideo{}
	}
	rows, err := s.Pool.Query(ctx, `SELECT term_id, lang, label FROM sign_term_labels WHERE term_id = ANY($1)`, ids)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id int64
		var lang, label string
		if err := rows.Scan(&id, &lang, &label); err != nil {
			rows.Close()
			return nil, err
		}
		terms[at[id]].Labels[lang] = label
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = s.Pool.Query(ctx, `SELECT `+videoCols+` FROM sign_videos v
		WHERE v.term_id = ANY($1) AND v.status IN ('approved', 'pending') ORDER BY v.reviewed_at, v.id`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		v, err := scanVideo(rows)
		if err != nil {
			return nil, err
		}
		t := &terms[at[*v.TermID]]
		if v.Status == "approved" {
			t.Clips = append(t.Clips, v)
		} else {
			t.Pending++
		}
	}
	return terms, rows.Err()
}

// LessonTerms lists a lesson's key terms in order.
func (s *Store) LessonTerms(ctx context.Context, lessonID int64) ([]SignTerm, error) {
	rows, err := s.Pool.Query(ctx, `SELECT term_id, source FROM lesson_sign_terms WHERE lesson_id=$1 ORDER BY position, term_id`, lessonID)
	if err != nil {
		return nil, err
	}
	terms := []SignTerm{}
	for rows.Next() {
		var t SignTerm
		if err := rows.Scan(&t.ID, &t.Source); err != nil {
			rows.Close()
			return nil, err
		}
		terms = append(terms, t)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return s.fillTerms(ctx, terms)
}

// Lexicon lists every term with at least one approved sign.
func (s *Store) Lexicon(ctx context.Context) ([]SignTerm, error) {
	rows, err := s.Pool.Query(ctx, `SELECT DISTINCT term_id FROM sign_videos WHERE kind='term' AND status='approved' ORDER BY term_id`)
	if err != nil {
		return nil, err
	}
	terms := []SignTerm{}
	for rows.Next() {
		var t SignTerm
		if err := rows.Scan(&t.ID); err != nil {
			rows.Close()
			return nil, err
		}
		terms = append(terms, t)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return s.fillTerms(ctx, terms)
}

// MissingSigns lists lesson terms with no approved sign yet: the open
// missing-sign requests, with the lessons that need each one.
func (s *Store) MissingSigns(ctx context.Context) ([]SignTerm, error) {
	rows, err := s.Pool.Query(ctx, `SELECT lt.term_id, array_agg(l.title ORDER BY l.id)
		FROM lesson_sign_terms lt JOIN lessons l ON l.id = lt.lesson_id
		WHERE NOT EXISTS (SELECT 1 FROM sign_videos v WHERE v.term_id = lt.term_id AND v.status = 'approved')
		GROUP BY lt.term_id ORDER BY min(lt.lesson_id), min(lt.position)`)
	if err != nil {
		return nil, err
	}
	terms := []SignTerm{}
	for rows.Next() {
		var t SignTerm
		if err := rows.Scan(&t.ID, &t.Lessons); err != nil {
			rows.Close()
			return nil, err
		}
		terms = append(terms, t)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return s.fillTerms(ctx, terms)
}

func (s *Store) TermExists(ctx context.Context, id int64) (bool, error) {
	var ok bool
	err := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM sign_terms WHERE id=$1)`, id).Scan(&ok)
	return ok, err
}

func (s *Store) CreateSignVideo(ctx context.Context, v SignVideo) (SignVideo, error) {
	return scanVideo(s.Pool.QueryRow(ctx, `INSERT INTO sign_videos AS v
		(kind, term_id, lesson_id, file, mime, bytes, signer, region, consent_at)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING `+videoCols,
		v.Kind, v.TermID, v.LessonID, v.File, v.Mime, v.Bytes, v.Signer, v.Region, v.ConsentAt))
}

func (s *Store) GetSignVideo(ctx context.Context, id int64) (SignVideo, error) {
	return scanVideo(s.Pool.QueryRow(ctx, `SELECT `+videoCols+` FROM sign_videos v WHERE v.id=$1`, id))
}

// ListSignVideos returns videos with one status, oldest first, with what each
// one is for.
func (s *Store) ListSignVideos(ctx context.Context, status string) ([]SignVideo, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+videoCols+`, coalesce(l.title, ''),
		coalesce((SELECT jsonb_object_agg(lang, label) FROM sign_term_labels WHERE term_id = v.term_id), '{}')
		FROM sign_videos v LEFT JOIN lessons l ON l.id = v.lesson_id
		WHERE v.status=$1 ORDER BY v.created_at`, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SignVideo{}
	for rows.Next() {
		var title string
		var labels map[string]string
		v, err := scanVideo(rows, &title, &labels)
		if err != nil {
			return nil, err
		}
		v.LessonTitle = title
		if len(labels) > 0 {
			v.TermLabels = labels
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func (s *Store) CountPendingSignVideos(ctx context.Context) (int, error) {
	var n int
	err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM sign_videos WHERE status='pending'`).Scan(&n)
	return n, err
}

// DecideSignVideo records a deaf reviewer's decision on a pending video.
func (s *Store) DecideSignVideo(ctx context.Context, id int64, approve bool, reviewer, note string) (SignVideo, error) {
	status := "rejected"
	if approve {
		status = "approved"
	}
	return scanVideo(s.Pool.QueryRow(ctx, `UPDATE sign_videos AS v SET status=$2, reviewer=$3, review_note=$4, reviewed_at=now()
		WHERE v.id=$1 AND v.status='pending' RETURNING `+videoCols, id, status, reviewer, note))
}

// WithdrawSignVideo honours a signer withdrawing their clip. The caller
// deletes the file.
func (s *Store) WithdrawSignVideo(ctx context.Context, id int64) (SignVideo, error) {
	return scanVideo(s.Pool.QueryRow(ctx, `UPDATE sign_videos AS v SET status='withdrawn', reviewed_at=now()
		WHERE v.id=$1 AND v.status <> 'withdrawn' RETURNING `+videoCols, id))
}

// LessonInterpreter returns the newest approved interpreter video for a
// lesson, or nil.
func (s *Store) LessonInterpreter(ctx context.Context, lessonID int64) (*SignVideo, error) {
	v, err := scanVideo(s.Pool.QueryRow(ctx, `SELECT `+videoCols+` FROM sign_videos v
		WHERE v.kind='lesson' AND v.lesson_id=$1 AND v.status='approved' ORDER BY v.reviewed_at DESC LIMIT 1`, lessonID))
	if errors.Is(err, ErrNotFound) {
		return nil, nil
	}
	return &v, err
}
