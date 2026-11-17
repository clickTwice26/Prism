package ai

import (
	"bytes"
	"context"
	"encoding/base64"
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
	key, baseURL                       string
	model, imageModel, ttsModel, voice string
	thinkingLevel                      string // "" leaves the model default
	http                               *http.Client
}

func NewGemini(key, baseURL, model, imageModel, ttsModel, voice, thinkingLevel string) *Gemini {
	return &Gemini{
		key: key, baseURL: strings.TrimRight(baseURL, "/"),
		model: model, imageModel: imageModel, ttsModel: ttsModel, voice: voice, thinkingLevel: thinkingLevel,
		http: &http.Client{Timeout: 120 * time.Second},
	}
}

func (g *Gemini) Name() string  { return "gemini" }
func (g *Gemini) Enabled() bool { return g.key != "" }

type geminiPart struct {
	Type     string `json:"type"`
	Text     string `json:"text,omitempty"`
	Data     string `json:"data,omitempty"`
	MimeType string `json:"mime_type,omitempty"`
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

// splitDataURL turns "data:image/png;base64,AAAA" into ("image/png", "AAAA").
func splitDataURL(u string) (string, string, error) {
	head, data, ok := strings.Cut(strings.TrimPrefix(u, "data:"), ",")
	mime, _, _ := strings.Cut(head, ";")
	if !ok || !strings.Contains(head, ";base64") || mime == "" {
		return "", "", fmt.Errorf("gemini: image must be a base64 data URL")
	}
	return mime, data, nil
}

func (g *Gemini) Generate(ctx context.Context, r Request) (string, error) {
	var input any = r.Text
	if r.ImageDataURL != "" {
		mime, data, err := splitDataURL(r.ImageDataURL)
		if err != nil {
			return "", err
		}
		input = []geminiPart{{Type: "text", Text: r.Text}, {Type: "image", Data: data, MimeType: mime}}
	}
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
		"input":              input,
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

func (g *Gemini) Image(ctx context.Context, prompt string) (string, error) {
	resp, err := g.interact(ctx, map[string]any{
		"model": g.imageModel,
		"input": prompt,
		"response_format": map[string]any{
			"type": "image", "mime_type": "image/png", "aspect_ratio": "1:1", "image_size": "1K",
		},
	})
	if err != nil {
		return "", err
	}
	for _, p := range resp.outputs() {
		if p.Type == "image" && p.Data != "" {
			mime := p.MimeType
			if mime == "" {
				mime = "image/png"
			}
			return "data:" + mime + ";base64," + p.Data, nil
		}
	}
	return "", fmt.Errorf("gemini image: no image returned")
}

// Speech returns a WAV file (24 kHz mono 16-bit, the unary default). The
// voice speaks Bangla, English and Malay; the style note keeps it calm.
func (g *Gemini) Speech(ctx context.Context, text, _ string) ([]byte, string, error) {
	resp, err := g.interact(ctx, map[string]any{
		"model": g.ttsModel,
		"input": []map[string]any{{
			"type": "user_input",
			"content": []map[string]any{{
				"type": "text",
				"text": text,
				"annotations": []map[string]any{{
					"type":  "speech_metadata",
					"style": "clear, calm and unhurried, for a student",
				}},
			}},
		}},
		"response_format":   map[string]any{"type": "audio"},
		"generation_config": map[string]any{"speech_config": []map[string]any{{"voice": g.voice}}},
	})
	if err != nil {
		return nil, "", err
	}
	for _, p := range resp.outputs() {
		if p.Type == "audio" && p.Data != "" {
			audio, err := base64.StdEncoding.DecodeString(p.Data)
			if err != nil {
				return nil, "", fmt.Errorf("gemini speech: bad audio data")
			}
			if strings.HasPrefix(strings.ToLower(p.MimeType), "audio/l16") {
				return wavFromPCM(audio, 24000), "audio/wav", nil // browsers cannot play raw PCM
			}
			return audio, "audio/wav", nil
		}
	}
	return nil, "", fmt.Errorf("gemini speech: no audio returned")
}

// wavFromPCM wraps raw 16-bit mono little-endian PCM in a WAV (RIFF) header.
func wavFromPCM(pcm []byte, rate int) []byte {
	var b bytes.Buffer
	le := func(v uint32, n int) {
		for i := 0; i < n; i++ {
			b.WriteByte(byte(v >> (8 * i)))
		}
	}
	b.WriteString("RIFF")
	le(uint32(36+len(pcm)), 4)
	b.WriteString("WAVEfmt ")
	le(16, 4)             // fmt chunk size
	le(1, 2)              // PCM
	le(1, 2)              // mono
	le(uint32(rate), 4)   // sample rate
	le(uint32(rate*2), 4) // byte rate
	le(2, 2)              // block align
	le(16, 2)             // bits per sample
	b.WriteString("data")
	le(uint32(len(pcm)), 4)
	b.Write(pcm)
	return b.Bytes()
}
