// Package ai holds Prism's prompts and runs them on a pluggable model
// provider: Google Gemini (default) or OpenAI. AI does only routine work for
// Prism Sign: finding a lesson's key terms and translating text. People record
// every sign and deaf reviewers approve it.
package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

var ErrNotConfigured = errors.New("no AI API key is set")

// Languages the app supports, keyed by short code.
var Languages = map[string]string{
	"en": "English",
	"bn": "Bengali (Bangla)",
	"ms": "Malay (Bahasa Malaysia)",
}

// Request is one text generation call.
type Request struct {
	System      string
	Text        string
	Temperature float64
	MaxTokens   int
	JSON        bool // the reply must be a JSON object
}

// Backend is a model provider.
type Backend interface {
	Name() string
	Enabled() bool
	Generate(ctx context.Context, r Request) (string, error)
}

type Client struct {
	b Backend
}

func New(b Backend) *Client { return &Client{b: b} }

func (c *Client) Enabled() bool    { return c.b.Enabled() }
func (c *Client) Provider() string { return c.b.Name() }

func (c *Client) gen(ctx context.Context, r Request) (string, error) {
	if !c.b.Enabled() {
		return "", ErrNotConfigured
	}
	out, err := c.b.Generate(ctx, r)
	return strings.TrimSpace(out), err
}

// parseJSON reads a JSON reply, tolerating a ```json fence around it.
func parseJSON(raw string, v any) error {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(strings.TrimSpace(raw), "```")
	return json.Unmarshal([]byte(strings.TrimSpace(raw)), v)
}

// KeyTerm is one subject term a deaf learner needs a sign for, written in
// each supported language.
type KeyTerm map[string]string

// KeyTerms picks the 5-10 subject words a lesson depends on, for the Bangla
// Sign Language glossary. Deaf learners miss subject vocabulary most, so the
// prompt asks for subject terms, not everyday words. Each term comes back in
// English, Bangla and Malay so one sign can be found in any of them; the
// label in the lesson's own language is copied exactly from the text.
func (c *Client) KeyTerms(ctx context.Context, text, lang string) ([]KeyTerm, error) {
	system := "You pick the key subject terms of a school lesson, for a sign language glossary for deaf learners. " +
		"Choose 5 to 10 terms that the lesson depends on and that a learner must know to follow it: subject " +
		"vocabulary such as 'chlorophyll' or 'evaporation', not everyday words, names of people or whole phrases. " +
		"The lesson is in " + langName(lang) + ". Copy each term in the lesson's language exactly as it appears " +
		"in the text (same spelling, singular form if both appear), and give the usual school word for it in the " +
		"other languages. Reply with JSON only: " +
		`{"terms":[{"en":"...","bn":"...","ms":"..."}]}`
	raw, err := c.gen(ctx, Request{System: system, Text: text, Temperature: 0, MaxTokens: 700, JSON: true})
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Terms []KeyTerm `json:"terms"`
	}
	if err := parseJSON(raw, &parsed); err != nil {
		return nil, fmt.Errorf("key terms: unreadable reply")
	}
	out := make([]KeyTerm, 0, len(parsed.Terms))
	for _, t := range parsed.Terms {
		clean := KeyTerm{}
		for code := range Languages {
			if v := strings.TrimSpace(t[code]); v != "" && len([]rune(v)) <= 60 {
				clean[code] = v
			}
		}
		if clean[lang] != "" {
			out = append(out, clean)
		}
	}
	if len(out) > 10 {
		out = out[:10]
	}
	return out, nil
}

// Translate puts lesson text or a caption into the learner's language, so
// the glossary signs are found in the words they read.
func (c *Client) Translate(ctx context.Context, text, lang string) (string, error) {
	system := "You translate classroom lesson text into " + langName(lang) + ". Keep every fact and the " +
		"exact meaning; do not add, remove or explain anything. Keep it natural for a student. If it is " +
		"already in that language, return it unchanged. Reply with only the translation."
	return c.gen(ctx, Request{System: system, Text: text, Temperature: 0.2, MaxTokens: 1500})
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
