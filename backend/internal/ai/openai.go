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

// OpenAI is the OpenAI REST backend (Chat Completions, Images, Audio).
type OpenAI struct {
	key, baseURL                       string
	model, imageModel, ttsModel, voice string
	http                               *http.Client
}

func NewOpenAI(key, baseURL, model, imageModel, ttsModel, voice string) *OpenAI {
	return &OpenAI{
		key: key, baseURL: strings.TrimRight(baseURL, "/"),
		model: model, imageModel: imageModel, ttsModel: ttsModel, voice: voice,
		http: &http.Client{Timeout: 120 * time.Second},
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
	var user any = r.Text
	if r.ImageDataURL != "" {
		user = []map[string]any{
			{"type": "text", "text": r.Text},
			{"type": "image_url", "image_url": map[string]string{"url": r.ImageDataURL}},
		}
	}
	body := map[string]any{
		"model": o.model,
		"messages": []map[string]any{
			{"role": "system", "content": r.System},
			{"role": "user", "content": user},
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

func (o *OpenAI) Image(ctx context.Context, prompt string) (string, error) {
	body := map[string]any{"model": o.imageModel, "prompt": prompt, "size": "1024x1024", "n": 1}
	if !strings.HasPrefix(o.imageModel, "gpt-image") {
		body["response_format"] = "b64_json"
	}
	out, err := o.post(ctx, "/images/generations", body)
	if err != nil {
		return "", err
	}
	var parsed struct {
		Data []struct {
			B64 string `json:"b64_json"`
		} `json:"data"`
	}
	if err := json.Unmarshal(out, &parsed); err != nil || len(parsed.Data) == 0 || parsed.Data[0].B64 == "" {
		return "", fmt.Errorf("openai image: no image returned")
	}
	return "data:image/png;base64," + parsed.Data[0].B64, nil
}

func (o *OpenAI) Speech(ctx context.Context, text, _ string) ([]byte, string, error) {
	audio, err := o.post(ctx, "/audio/speech", map[string]any{
		"model":           o.ttsModel,
		"voice":           o.voice,
		"input":           text,
		"response_format": "mp3",
		"instructions": "Read this clearly and calmly for a student. Pronounce English scientific " +
			"terms naturally even inside Bangla or Malay sentences.",
	})
	return audio, "audio/mpeg", err
}
