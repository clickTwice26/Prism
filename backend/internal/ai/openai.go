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

// OpenAI is the OpenAI REST backend (Chat Completions).
type OpenAI struct {
	key, baseURL string
	model        string
	http         *http.Client
}

func NewOpenAI(key, baseURL, model string) *OpenAI {
	return &OpenAI{
		key: key, baseURL: strings.TrimRight(baseURL, "/"),
		model: model,
		http:  &http.Client{Timeout: 120 * time.Second},
	}
}

func (o *OpenAI) Name() string  { return "openai" }
func (o *OpenAI) Enabled() bool { return o.key != "" }

func (o *OpenAI) post(ctx context.Context, path string, body any) ([]byte, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, o.baseURL+path, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+o.key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := o.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("openai %s: status %d: %s", path, resp.StatusCode, truncate(string(out), 300))
	}
	return out, nil
}

func (o *OpenAI) Generate(ctx context.Context, r Request) (string, error) {
	body := map[string]any{
		"model": o.model,
		"messages": []map[string]any{
			{"role": "system", "content": r.System},
			{"role": "user", "content": r.Text},
		},
		"temperature": r.Temperature,
		"max_tokens":  r.MaxTokens,
	}
	if r.JSON {
		body["response_format"] = map[string]string{"type": "json_object"}
	}
	out, err := o.post(ctx, "/chat/completions", body)
	if err != nil {
		return "", err
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(out, &parsed); err != nil || len(parsed.Choices) == 0 {
		return "", fmt.Errorf("openai chat: unexpected response")
	}
	return parsed.Choices[0].Message.Content, nil
}
