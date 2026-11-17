package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ---- Learners (N1) ----

type Learner struct {
	ID        int64     `json:"id"`
	Code      string    `json:"code"`
	Profile   string    `json:"profile"`
	Lang      string    `json:"lang"`
	CreatedAt time.Time `json:"created_at"`
}

func (s *Store) CreateLearner(ctx context.Context, l Learner) (Learner, error) {
	err := s.Pool.QueryRow(ctx, `INSERT INTO learners(code, profile, lang) VALUES($1,$2,$3) RETURNING id, created_at`,
		l.Code, l.Profile, l.Lang).Scan(&l.ID, &l.CreatedAt)
	return l, err
}

func (s *Store) GetLearner(ctx context.Context, id int64) (Learner, error) {
	var l Learner
	err := s.Pool.QueryRow(ctx, `SELECT id, code, profile, lang, created_at FROM learners WHERE id=$1`, id).
		Scan(&l.ID, &l.Code, &l.Profile, &l.Lang, &l.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return l, ErrNotFound
	}
	return l, err
}

func (s *Store) ListLearners(ctx context.Context) ([]Learner, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, code, profile, lang, created_at FROM learners ORDER BY code`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Learner{}
	for rows.Next() {
		var l Learner
		if err := rows.Scan(&l.ID, &l.Code, &l.Profile, &l.Lang, &l.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// ---- Lesson chunks ----

type Question struct {
	Question string   `json:"question"`
	Options  []string `json:"options"`
	Answer   int      `json:"answer"`
}

type Chunk struct {
	Idx      int
	Text     string
	Question Question
}

func (s *Store) GetChunks(ctx context.Context, lessonID int64, lang string) ([]Chunk, error) {
	rows, err := s.Pool.Query(ctx, `SELECT idx, text, question FROM lesson_chunks
		WHERE lesson_id=$1 AND lang=$2 ORDER BY idx`, lessonID, lang)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Chunk
	for rows.Next() {
		var c Chunk
		var q []byte
		if err := rows.Scan(&c.Idx, &c.Text, &q); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(q, &c.Question); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// SaveChunks stores a lesson's chunks for a language, replacing any old set.
func (s *Store) SaveChunks(ctx context.Context, lessonID int64, lang string, chunks []Chunk) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM lesson_chunks WHERE lesson_id=$1 AND lang=$2`, lessonID, lang); err != nil {
		return err
	}
	for _, c := range chunks {
		q, _ := json.Marshal(c.Question)
		if _, err := tx.Exec(ctx, `INSERT INTO lesson_chunks(lesson_id, lang, idx, text, question) VALUES($1,$2,$3,$4,$5)`,
			lessonID, lang, c.Idx, c.Text, q); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ---- Attempts ----

type Attempt struct {
	ID        int64
	LearnerID int64
	LessonID  int64
	ChunkIdx  int
	Mix       string
	Correct   *bool
}

func (s *Store) CreateAttempt(ctx context.Context, a Attempt, reason string) (int64, error) {
	var id int64
	err := s.Pool.QueryRow(ctx, `INSERT INTO attempts(learner_id, lesson_id, chunk_idx, mix, reason)
		VALUES($1,$2,$3,$4,$5) RETURNING id`, a.LearnerID, a.LessonID, a.ChunkIdx, a.Mix, reason).Scan(&id)
	return id, err
}

func (s *Store) GetAttempt(ctx context.Context, id int64) (Attempt, error) {
	var a Attempt
	err := s.Pool.QueryRow(ctx, `SELECT id, learner_id, lesson_id, chunk_idx, mix, correct FROM attempts WHERE id=$1`, id).
		Scan(&a.ID, &a.LearnerID, &a.LessonID, &a.ChunkIdx, &a.Mix, &a.Correct)
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

// AnswerAttempt records the result once; a second answer is ignored.
func (s *Store) AnswerAttempt(ctx context.Context, id int64, correct bool) (bool, error) {
	tag, err := s.Pool.Exec(ctx, `UPDATE attempts SET correct=$2, answered_at=now() WHERE id=$1 AND correct IS NULL`, id, correct)
	return tag.RowsAffected() == 1, err
}

// MixStats is how often one support mix led to a correct answer for a learner.
type MixStats struct {
	Mix     string `json:"mix"`
	Tries   int    `json:"tries"`
	Correct int    `json:"correct"`
}

func (s *Store) LearnerMixStats(ctx context.Context, learnerID int64) ([]MixStats, error) {
	rows, err := s.Pool.Query(ctx, `SELECT mix, count(*), count(*) FILTER (WHERE correct)
		FROM attempts WHERE learner_id=$1 AND correct IS NOT NULL GROUP BY mix ORDER BY mix`, learnerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MixStats{}
	for rows.Next() {
		var m MixStats
		if err := rows.Scan(&m.Mix, &m.Tries, &m.Correct); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
