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

	// AIProvider is "gemini" (default) or "openai".
	AIProvider string

	GeminiKey           string
	GeminiBaseURL       string
	GeminiModel         string
	GeminiImageModel    string
	GeminiTTSModel      string
	GeminiTTSVoice      string
	GeminiThinkingLevel string

	OpenAIKey        string
	OpenAIBaseURL    string
	OpenAIModel      string
	OpenAIImageModel string
	OpenAITTSModel   string
	OpenAITTSVoice   string

	// Piper is optional: when PiperBin is set and a voice model exists for a
	// language, read-aloud runs fully offline on the server.
	PiperBin       string
	PiperVoicesDir string

	// AI endpoints are rate limited per client IP (requests per minute).
	AIRateLimitPerMin int
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
		GeminiImageModel:    env("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-lite-image"),
		GeminiTTSModel:      env("GEMINI_TTS_MODEL", "gemini-3.8-flash-lite-tts"),
		GeminiTTSVoice:      env("GEMINI_TTS_VOICE", "Kore"),
		GeminiThinkingLevel: env("GEMINI_THINKING_LEVEL", "low"),
		OpenAIKey:           env("OPENAI_API_KEY", ""),
		OpenAIBaseURL:       env("OPENAI_BASE_URL", "https://api.openai.com/v1"),
		OpenAIModel:         env("OPENAI_MODEL", "gpt-4.1-mini"),
		OpenAIImageModel:    env("OPENAI_IMAGE_MODEL", "gpt-image-1"),
		OpenAITTSModel:      env("OPENAI_TTS_MODEL", "gpt-4o-mini-tts"),
		OpenAITTSVoice:      env("OPENAI_TTS_VOICE", "coral"),
		PiperBin:            env("PIPER_BIN", ""),
		PiperVoicesDir:      env("PIPER_VOICES_DIR", "piper_voices"),
		AIRateLimitPerMin:   envInt("AI_RATE_LIMIT_PER_MIN", 30),
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
