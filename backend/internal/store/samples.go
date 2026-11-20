package store

import (
	"context"
	"encoding/json"
	"time"
)

// SignSample is a recorded practice sample: hand skeleton points per frame,
// never video.
type SignSample struct {
	ID             int64           `json:"id"`
	Kind           string          `json:"kind"`
	Label          string          `json:"label"`
	Signer         string          `json:"signer"`
	Dominant       string          `json:"dominant"`
	Deaf           bool            `json:"deaf"`
	ConsentAt      time.Time       `json:"consent_at"`
	Frames         json.RawMessage `json:"frames,omitempty"`
	Features       json.RawMessage `json:"features,omitempty"`
	FeatureVersion int             `json:"feature_version"`
	CreatedAt      time.Time       `json:"created_at"`
}

func (s *Store) CreateSignSample(ctx context.Context, x SignSample) (SignSample, error) {
	err := s.Pool.QueryRow(ctx, `INSERT INTO sign_samples
		(kind, label, signer, dominant, deaf, consent_at, frames, features, feature_version)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, created_at`,
		x.Kind, x.Label, x.Signer, x.Dominant, x.Deaf, x.ConsentAt, x.Frames, x.Features, x.FeatureVersion).
		Scan(&x.ID, &x.CreatedAt)
	return x, err
}

// ListSignSamples returns samples of one kind; full includes frames and
// features (for training), otherwise only the metadata.
func (s *Store) ListSignSamples(ctx context.Context, kind string, full bool) ([]SignSample, error) {
	cols := `id, kind, label, signer, dominant, deaf, consent_at, NULL::jsonb, NULL::jsonb, feature_version, created_at`
	if full {
		cols = `id, kind, label, signer, dominant, deaf, consent_at, frames, features, feature_version, created_at`
	}
	rows, err := s.Pool.Query(ctx, `SELECT `+cols+` FROM sign_samples WHERE kind=$1 ORDER BY id`, kind)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SignSample{}
	for rows.Next() {
		var x SignSample
		var frames, features []byte
		if err := rows.Scan(&x.ID, &x.Kind, &x.Label, &x.Signer, &x.Dominant, &x.Deaf, &x.ConsentAt,
			&frames, &features, &x.FeatureVersion, &x.CreatedAt); err != nil {
			return nil, err
		}
		if frames != nil {
			x.Frames = frames
		}
		if features != nil {
			x.Features = features
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

// DeleteSignSample removes a sample when its signer withdraws it.
func (s *Store) DeleteSignSample(ctx context.Context, id int64) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM sign_samples WHERE id=$1`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}
