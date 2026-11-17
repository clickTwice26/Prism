// Package ai calls the OpenAI REST API for simplification, translation,
// image description, illustration and speech.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var ErrNotConfigured = errors.New("OPENAI_API_KEY is not set")

// Languages the app supports, keyed by short code.
var Languages = map[string]string{
	"en": "English",
	"bn": "Bengali (Bangla)",
	"ms": "Malay (Bahasa Malaysia)",
}

type Client struct {
	key, baseURL                       string
	model, imageModel, ttsModel, voice string
	http                               *http.Client
}

func New(key, baseURL, model, imageModel, ttsModel, voice string) *Client {
	return &Client{
		key: key, baseURL: strings.TrimRight(baseURL, "/"),
		model: model, imageModel: imageModel, ttsModel: ttsModel, voice: voice,
		http: &http.Client{Timeout: 120 * time.Second},
	}
}

func (c *Client) Enabled() bool { return c.key != "" }

func (c *Client) post(ctx context.Context, path string, body any) ([]byte, error) {
	if !c.Enabled() {
		return nil, ErrNotConfigured
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
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

type message struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

func (c *Client) chat(ctx context.Context, system string, user any, temperature float64, maxTokens int) (string, error) {
	out, err := c.post(ctx, "/chat/completions", map[string]any{
		"model":       c.model,
		"messages":    []message{{"system", system}, {"user", user}},
		"temperature": temperature,
		"max_tokens":  maxTokens,
	})
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
	return strings.TrimSpace(parsed.Choices[0].Message.Content), nil
}

// Simplify rewrites text in plain language without changing facts. Research
// shows automatic simplification often adds or drops facts (Devaraj et al.,
// 2022), so the prompt forbids it and CheckFacts verifies the output.
func (c *Client) Simplify(ctx context.Context, text, lang string) (string, error) {
	system := "You simplify classroom text for learners with intellectual disability, autism, dyslexia " +
		"or slow reading. Rewrite it in short, plain sentences (one idea per sentence, under 15 words). " +
		"Keep every fact, number and named term. Do not add, remove, explain or invent anything. " +
		"If a technical term must stay, keep it and add a short plain meaning in brackets the first time. " +
		"Write in " + langName(lang) + ". Reply with only the simplified text."
	return c.chat(ctx, system, text, 0.2, 900)
}

// FactCheck compares a simplification with its source and reports facts that
// were added, dropped or changed.
type FactCheck struct {
	Faithful bool     `json:"faithful"`
	Issues   []string `json:"issues"`
}

func (c *Client) CheckFacts(ctx context.Context, original, simplified string) (FactCheck, error) {
	system := "You check a simplified text against its original. List every fact that the simplified " +
		"text adds, drops or changes. Ignore wording and sentence-splitting changes. Reply with JSON only: " +
		`{"faithful": true|false, "issues": ["..."]}`
	user := "ORIGINAL:\n" + original + "\n\nSIMPLIFIED:\n" + simplified
	raw, err := c.chat(ctx, system, user, 0, 400)
	if err != nil {
		return FactCheck{}, err
	}
	raw = strings.TrimSuffix(strings.TrimPrefix(strings.TrimSpace(raw), "```json"), "```")
	var fc FactCheck
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &fc); err != nil {
		return FactCheck{}, fmt.Errorf("fact check: unreadable reply")
	}
	if fc.Issues == nil {
		fc.Issues = []string{}
	}
	return fc, nil
}

// Quiz builds short comprehension questions: the most reliable measure of
// understanding for readers with intellectual disability (Säuberli et al., 2024).
type QuizQuestion struct {
	Question string   `json:"question"`
	Options  []string `json:"options"`
	Answer   int      `json:"answer"`
}

func (c *Client) Quiz(ctx context.Context, text, lang string, n int) ([]QuizQuestion, error) {
	system := fmt.Sprintf("Write %d simple multiple-choice comprehension questions about the text, in %s. "+
		"Each has 3 short options and exactly one correct answer taken directly from the text. "+
		`Reply with JSON only: {"questions":[{"question":"...","options":["...","...","..."],"answer":0}]}`,
		n, langName(lang))
	raw, err := c.chat(ctx, system, text, 0.3, 900)
	if err != nil {
		return nil, err
	}
	raw = strings.TrimSuffix(strings.TrimPrefix(strings.TrimSpace(raw), "```json"), "```")
	var parsed struct {
		Questions []QuizQuestion `json:"questions"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &parsed); err != nil {
		return nil, fmt.Errorf("quiz: unreadable reply")
	}
	return parsed.Questions, nil
}

func (c *Client) Translate(ctx context.Context, text, lang string) (string, error) {
	system := "You translate classroom lesson text into " + langName(lang) + ". Keep every fact and the " +
		"exact meaning; do not add, remove or explain anything. Keep it natural for a student. If it is " +
		"already in that language, return it unchanged. Reply with only the translation."
	return c.chat(ctx, system, text, 0.2, 1500)
}

// DescribeImage writes an educational description for blind learners. Vision
// models can invent plausible details (Aljedaani et al., 2026), so the prompt
// asks the model to flag what it cannot read rather than guess.
func (c *Client) DescribeImage(ctx context.Context, imageDataURL, lang, detail string) (string, error) {
	length := "2-4 sentences"
	if detail == "detailed" {
		length = "a short paragraph of 5-8 sentences, covering every label and how the parts connect"
	}
	system := "You describe images for blind and low-vision students in a classroom. Describe only what " +
		"is actually visible: the educational content, labels, layout and the relationships that matter. " +
		"If text is unreadable or something is unclear, say so plainly instead of guessing. Length: " +
		length + ". Write in " + langName(lang) + ". Reply with only the description."
	user := []map[string]any{
		{"type": "text", "text": "Describe this image for a blind student."},
		{"type": "image_url", "image_url": map[string]string{"url": imageDataURL}},
	}
	return c.chat(ctx, system, user, 0.2, 600)
}

// Illustrate generates a simple, text-free picture for a concept and returns
// a PNG data URL.
func (c *Client) Illustrate(ctx context.Context, concept string) (string, error) {
	prompt := "A clear, friendly educational illustration for a school lesson. Flat vector style, " +
		"calm colours, plain background, no text and no labels, simple enough for a young or " +
		"neurodivergent learner to understand at a glance. Show: " + strings.TrimSpace(concept)
	body := map[string]any{"model": c.imageModel, "prompt": prompt, "size": "1024x1024", "n": 1}
	if !strings.HasPrefix(c.imageModel, "gpt-image") {
		body["response_format"] = "b64_json"
	}
	out, err := c.post(ctx, "/images/generations", body)
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

// Speech returns MP3 audio for text.
func (c *Client) Speech(ctx context.Context, text string) ([]byte, error) {
	return c.post(ctx, "/audio/speech", map[string]any{
		"model":           c.ttsModel,
		"voice":           c.voice,
		"input":           text,
		"response_format": "mp3",
		"instructions": "Read this clearly and calmly for a student. Pronounce English scientific " +
			"terms naturally even inside Bangla or Malay sentences.",
	})
}

func langName(code string) string {
	if n, ok := Languages[code]; ok {
		return n
	}
	return Languages["en"]
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
