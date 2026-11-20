// Package config loads runtime settings from environment variables.
package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	CORSOrigins []string

	// AIProvider is "gemini" (default) or "openai". AI finds lesson key terms
	// and translates lesson text and captions.
	AIProvider string

	GeminiKey           string
	GeminiBaseURL       string
	GeminiModel         string
	GeminiThinkingLevel string

	OpenAIKey     string
	OpenAIBaseURL string
	OpenAIModel   string

	// AI endpoints are rate limited per client IP (requests per minute).
	AIRateLimitPerMin int

	// Where uploaded sign videos are stored, and an optional IsharaKotha
	// corpus folder whose word list is checked for existing signs.
	SignMediaDir     string
	SignReferenceDir string
}

func Load() Config {
	return Config{
		Port:                env("PORT", "8080"),
		DatabaseURL:         env("DATABASE_URL", "postgres://prism:prism@localhost:55432/prism?sslmode=disable"),
		RedisURL:            env("REDIS_URL", "redis://localhost:56379/0"),
		CORSOrigins:         splitList(env("CORS_ORIGINS", "http://localhost:3100")),
		AIProvider:          strings.ToLower(env("AI_PROVIDER", "gemini")),
		GeminiKey:           env("GEMINI_API_KEY", ""),
		GeminiBaseURL:       env("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"),
		GeminiModel:         env("GEMINI_MODEL", "gemini-4-hydrogen"),
		GeminiThinkingLevel: env("GEMINI_THINKING_LEVEL", "low"),
		OpenAIKey:           env("OPENAI_API_KEY", ""),
		OpenAIBaseURL:       env("OPENAI_BASE_URL", "https://api.openai.com/v1"),
		OpenAIModel:         env("OPENAI_MODEL", "gpt-4.1-mini"),
		AIRateLimitPerMin:   envInt("AI_RATE_LIMIT_PER_MIN", 30),
		SignMediaDir:        env("SIGN_MEDIA_DIR", "media/signs"),
		SignReferenceDir:    env("SIGN_REFERENCE_DIR", "../data/isharakotha/raw/extracted"),
	}
}

func env(key, def string) string {
	if v, ok := os.LookupEnv(key); ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return def
}

func envInt(key string, def int) int {
	if n, err := strconv.Atoi(env(key, "")); err == nil {
		return n
	}
	return def
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
