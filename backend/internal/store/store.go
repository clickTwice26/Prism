// Package store owns the PostgreSQL connection pool, migrations and queries.
package store

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

var ErrNotFound = errors.New("not found")

type Store struct {
	Pool *pgxpool.Pool
}

// Open connects to Postgres, retrying for up to 30s so the API can start
// alongside a database container that is still booting.
func Open(ctx context.Context, url string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	deadline := time.Now().Add(30 * time.Second)
	for {
		if err = pool.Ping(ctx); err == nil {
			return &Store{Pool: pool}, nil
		}
		if time.Now().After(deadline) {
			pool.Close()
			return nil, fmt.Errorf("database not reachable: %w", err)
		}
		time.Sleep(time.Second)
	}
}

func (s *Store) Close() { s.Pool.Close() }

// Migrate applies embedded migrations in filename order, once each, inside a
// transaction guarded by an advisory lock so parallel instances are safe.
func (s *Store) Migrate(ctx context.Context) error {
	names, err := fs.Glob(migrationFS, "migrations/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(names)

	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(727274)`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	for _, name := range names {
		base := strings.TrimPrefix(name, "migrations/")
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name=$1)`, base).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		sql, err := migrationFS.ReadFile(name)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("migration %s: %w", base, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations(name) VALUES($1)`, base); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ---- Lessons ----

type Lesson struct {
	ID        int64     `json:"id"`
	Subject   string    `json:"subject"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	Language  string    `json:"language"`
	CreatedAt time.Time `json:"created_at"`
}

const lessonCols = `id, subject, title, body, language, created_at`

func scanLesson(row pgx.Row) (Lesson, error) {
	var l Lesson
	err := row.Scan(&l.ID, &l.Subject, &l.Title, &l.Body, &l.Language, &l.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return l, ErrNotFound
	}
	return l, err
}

func (s *Store) ListLessons(ctx context.Context) ([]Lesson, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+lessonCols+` FROM lessons ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Lesson{}
	for rows.Next() {
		l, err := scanLesson(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (s *Store) GetLesson(ctx context.Context, id int64) (Lesson, error) {
	return scanLesson(s.Pool.QueryRow(ctx, `SELECT `+lessonCols+` FROM lessons WHERE id=$1`, id))
}

func (s *Store) CreateLesson(ctx context.Context, l Lesson) (Lesson, error) {
	return scanLesson(s.Pool.QueryRow(ctx,
		`INSERT INTO lessons(subject, title, body, language) VALUES($1,$2,$3,$4) RETURNING `+lessonCols,
		l.Subject, l.Title, l.Body, l.Language))
}

// SeedLessons inserts the sample lesson when the table is empty.
func (s *Store) SeedLessons(ctx context.Context) error {
	var n int
	if err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM lessons`).Scan(&n); err != nil || n > 0 {
		return err
	}
	_, err := s.CreateLesson(ctx, Lesson{
		Subject:  "Biology",
		Title:    "Photosynthesis",
		Language: "en",
		Body: "Photosynthesis is the process plants use to turn sunlight, water, and carbon dioxide " +
			"into glucose and oxygen. The green pigment chlorophyll absorbs light energy, which powers " +
			"a series of chemical reactions inside the chloroplasts of plant cells.",
	})
	return err
}

// ---- Usage ----

func (s *Store) LogUsage(ctx context.Context, feature, action string, meta map[string]any) error {
	var raw []byte
	if meta != nil {
		var err error
		if raw, err = json.Marshal(meta); err != nil {
			return err
		}
	}
	_, err := s.Pool.Exec(ctx, `INSERT INTO usage_events(feature, action, meta) VALUES($1,$2,$3)`, feature, action, raw)
	return err
}

type UsageSummary struct {
	TotalEvents int            `json:"total_events"`
	ByFeature   map[string]int `json:"by_feature"`
}

func (s *Store) UsageSummary(ctx context.Context) (UsageSummary, error) {
	out := UsageSummary{ByFeature: map[string]int{}}
	rows, err := s.Pool.Query(ctx, `SELECT feature, count(*) FROM usage_events GROUP BY feature`)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var f string
		var n int
		if err := rows.Scan(&f, &n); err != nil {
			return out, err
		}
		out.ByFeature[f] = n
		out.TotalEvents += n
	}
	return out, rows.Err()
}
