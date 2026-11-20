package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// GeminiAPIRevision pins the Interactions API response schema ("steps").
const GeminiAPIRevision = "2026-05-20"

// Gemini is the Google Gemini backend, using the Interactions API
// (POST /v1beta/interactions), Google's recommended API since 2026.
type Gemini struct {
	key, baseURL  string
	model         string
	thinkingLevel string // "" leaves the model default
	http          *http.Client
}

func NewGemini(key, baseURL, model, thinkingLevel string) *Gemini {
	return &Gemini{
		key: key, baseURL: strings.TrimRight(baseURL, "/"),
		model: model, thinkingLevel: thinkingLevel,
		http: &http.Client{Timeout: 120 * time.Second},
	}
}

func (g *Gemini) Name() string  { return "gemini" }
func (g *Gemini) Enabled() bool { return g.key != "" }

type geminiPart struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type geminiResponse struct {
	Steps []struct {
		Type    string       `json:"type"`
		Content []geminiPart `json:"content"`
	} `json:"steps"`
}

func (g *Gemini) interact(ctx context.Context, body map[string]any) (geminiResponse, error) {
	var parsed geminiResponse
	raw, err := json.Marshal(body)
	if err != nil {
		return parsed, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.baseURL+"/interactions", bytes.NewReader(raw))
	if err != nil {
		return parsed, err
	}
	req.Header.Set("x-goog-api-key", g.key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Api-Revision", GeminiAPIRevision)
	resp, err := g.http.Do(req)
	if err != nil {
		return parsed, err
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(resp.Body)
	if err != nil {
		return parsed, err
	}
	if resp.StatusCode >= 300 {
		return parsed, fmt.Errorf("gemini: status %d: %s", resp.StatusCode, truncate(string(out), 300))
	}
	if err := json.Unmarshal(out, &parsed); err != nil {
		return parsed, fmt.Errorf("gemini: unreadable response")
	}
	return parsed, nil
}

// outputs returns the content parts of the model's output steps, in order.
func (r geminiResponse) outputs() []geminiPart {
	var parts []geminiPart
	for _, s := range r.Steps {
		if s.Type == "model_output" {
			parts = append(parts, s.Content...)
		}
	}
	return parts
}

func (g *Gemini) Generate(ctx context.Context, r Request) (string, error) {
	cfg := map[string]any{"temperature": r.Temperature}
	if r.MaxTokens > 0 {
		// Thinking tokens count towards the output budget, so leave headroom.
		cfg["max_output_tokens"] = r.MaxTokens + 2048
	}
	if g.thinkingLevel != "" {
		cfg["thinking_level"] = g.thinkingLevel
	}
	body := map[string]any{
		"model":              g.model,
		"system_instruction": r.System,
		"input":              r.Text,
		"generation_config":  cfg,
	}
	if r.JSON {
		body["response_format"] = map[string]any{"type": "text", "mime_type": "application/json"}
	}
	resp, err := g.interact(ctx, body)
	if err != nil {
		return "", err
	}
	var b strings.Builder
	for _, p := range resp.outputs() {
		if p.Type == "text" {
			b.WriteString(p.Text)
		}
	}
	if b.Len() == 0 {
		return "", fmt.Errorf("gemini: no text in response")
	}
	return b.String(), nil
}
