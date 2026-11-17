// Package cache wraps Redis for response caching and rate limiting.
package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	R *redis.Client
}

func Open(ctx context.Context, url string) (*Cache, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	c := redis.NewClient(opts)
	deadline := time.Now().Add(30 * time.Second)
	for {
		if err = c.Ping(ctx).Err(); err == nil {
			return &Cache{R: c}, nil
		}
		if time.Now().After(deadline) {
			return nil, fmt.Errorf("redis not reachable: %w", err)
		}
		time.Sleep(time.Second)
	}
}

func (c *Cache) Close() error { return c.R.Close() }

// Key builds a stable cache key from a namespace and any number of parts.
func Key(namespace string, parts ...string) string {
	h := sha256.New()
	for _, p := range parts {
		h.Write([]byte(p))
		h.Write([]byte{0})
	}
	return "cache:" + namespace + ":" + hex.EncodeToString(h.Sum(nil))
}

// Remember returns the cached JSON value for key, or calls fn, stores its
// result for ttl and returns it. Redis errors never fail the request.
func Remember[T any](ctx context.Context, c *Cache, key string, ttl time.Duration, fn func() (T, error)) (T, error) {
	var zero T
	if raw, err := c.R.Get(ctx, key).Bytes(); err == nil {
		var v T
		if json.Unmarshal(raw, &v) == nil {
			return v, nil
		}
	}
	v, err := fn()
	if err != nil {
		return zero, err
	}
	if raw, err := json.Marshal(v); err == nil {
		_ = c.R.Set(ctx, key, raw, ttl).Err()
	}
	return v, nil
}

var ErrRateLimited = errors.New("rate limited")

// Allow is a fixed-window limiter: at most limit calls per minute per subject.
func (c *Cache) Allow(ctx context.Context, subject string, limit int) error {
	if limit <= 0 {
		return nil
	}
	key := fmt.Sprintf("rl:%s:%d", subject, time.Now().Unix()/60)
	n, err := c.R.Incr(ctx, key).Result()
	if err != nil {
		return nil // fail open: Redis trouble should not block learners
	}
	if n == 1 {
		c.R.Expire(ctx, key, 70*time.Second)
	}
	if n > int64(limit) {
		return ErrRateLimited
	}
	return nil
}
