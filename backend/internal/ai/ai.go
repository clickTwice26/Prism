// Package ai holds Prism's research-informed prompts and runs them on a
// pluggable model provider: Google Gemini (default) or OpenAI.
package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
)

var ErrNotConfigured = errors.New("no AI API key is set")

// Languages the app supports, keyed by short code.
var Languages = map[string]string{
	"en": "English",
	"bn": "Bengali (Bangla)",
	"ms": "Malay (Bahasa Malaysia)",
}

// Request is one text generation call. ImageDataURL, when set, is sent with
// the text so the model can see the image.
type Request struct {
	System       string
	Text         string
	ImageDataURL string
	Temperature  float64
	MaxTokens    int
	JSON         bool // the reply must be a JSON object
}

// Backend is a model provider.
type Backend interface {
	Name() string
	Enabled() bool
	Generate(ctx context.Context, r Request) (string, error)
	// Image returns a picture for the prompt as a data URL.
	Image(ctx context.Context, prompt string) (string, error)
	// Speech returns spoken audio for text and its MIME type.
	Speech(ctx context.Context, text, lang string) ([]byte, string, error)
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

// Simplify rewrites text in plain language without changing facts. Research
// shows automatic simplification often adds or drops facts (Devaraj et al.,
// 2022), so the prompt forbids it and CheckFacts verifies the output.
func (c *Client) Simplify(ctx context.Context, text, lang string, fix []string) (string, error) {
	system := "You simplify classroom text for learners with intellectual disability, autism, dyslexia " +
		"or slow reading. Rewrite it in short, plain sentences (one idea per sentence, under 15 words). " +
		"Keep every fact, number and named term. Do not add, remove, explain or invent anything. " +
		"If a technical term must stay, keep it and add a short plain meaning in brackets the first time. " +
		"Write in " + langName(lang) + ". Reply with only the simplified text."
	user := text
	if len(fix) > 0 {
		user = text + "\n\nA previous simplification of this text had these problems. Avoid every one:\n- " +
			strings.Join(fix, "\n- ")
	}
	return c.gen(ctx, Request{System: system, Text: user, Temperature: 0.2, MaxTokens: 900})
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
	raw, err := c.gen(ctx, Request{System: system, Text: user, Temperature: 0, MaxTokens: 400, JSON: true})
	if err != nil {
		return FactCheck{}, err
	}
	var fc FactCheck
	if err := parseJSON(raw, &fc); err != nil {
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
	raw, err := c.gen(ctx, Request{System: system, Text: text, Temperature: 0.3, MaxTokens: 900, JSON: true})
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Questions []QuizQuestion `json:"questions"`
	}
	if err := parseJSON(raw, &parsed); err != nil {
		return nil, fmt.Errorf("quiz: unreadable reply")
	}
	return parsed.Questions, nil
}

func (c *Client) Translate(ctx context.Context, text, lang string) (string, error) {
	system := "You translate classroom lesson text into " + langName(lang) + ". Keep every fact and the " +
		"exact meaning; do not add, remove or explain anything. Keep it natural for a student. If it is " +
		"already in that language, return it unchanged. Reply with only the translation."
	return c.gen(ctx, Request{System: system, Text: text, Temperature: 0.2, MaxTokens: 1500})
}

// DescribeImageSamples writes n independent descriptions of one image for
// blind learners, as parallel calls. Vision models can invent plausible
// details (Aljedaani et al., 2026); comparing independent samples exposes
// them (Chen et al., 2025).
func (c *Client) DescribeImageSamples(ctx context.Context, imageDataURL, lang, detail string, n int) ([]string, error) {
	if !c.b.Enabled() {
		return nil, ErrNotConfigured
	}
	length := "2-4 sentences"
	if detail == "detailed" {
		length = "a short paragraph of 5-8 sentences, covering every label and how the parts connect"
	}
	r := Request{
		System: "You describe images for blind and low-vision students in a classroom. Describe only what " +
			"is actually visible: the educational content, labels, layout and the relationships that matter. " +
			"If text is unreadable or something is unclear, say so plainly instead of guessing. Length: " +
			length + ". Write in " + langName(lang) + ". Reply with only the description.",
		Text:         "Describe this image for a blind student.",
		ImageDataURL: imageDataURL,
		Temperature:  0.8,
		MaxTokens:    600,
	}
	out := make([]string, n)
	errs := make([]error, n)
	var wg sync.WaitGroup
	for i := range n {
		wg.Go(func() { out[i], errs[i] = c.gen(ctx, r) })
	}
	wg.Wait()
	var samples []string
	for i := range n {
		if errs[i] == nil && out[i] != "" {
			samples = append(samples, out[i])
		}
	}
	if len(samples) < 2 {
		return nil, fmt.Errorf("describe: only %d of %d samples succeeded: %w", len(samples), n, errors.Join(errs...))
	}
	return samples, nil
}

// Consensus merges independent descriptions: it keeps only details they all
// agree on and lists the ones they disagree about, for a teacher to check.
type Consensus struct {
	Description string   `json:"consensus"`
	Disputed    []string `json:"disputed"`
}

func (c *Client) Consensus(ctx context.Context, descriptions []string, lang string) (Consensus, error) {
	system := "You compare independent descriptions of the same image, written for a blind student. " +
		"Write ONE description in " + langName(lang) + " that contains only details every description states " +
		"or clearly implies. Then list each concrete detail (object, label, number, colour, position, text) " +
		"that the descriptions state differently or that only one of them claims. Leave out mere differences " +
		"in wording or length. Reply with JSON only: " + `{"consensus":"...","disputed":["..."]}`
	var b strings.Builder
	for i, d := range descriptions {
		fmt.Fprintf(&b, "DESCRIPTION %d:\n%s\n\n", i+1, d)
	}
	raw, err := c.gen(ctx, Request{System: system, Text: b.String(), Temperature: 0, MaxTokens: 700, JSON: true})
	if err != nil {
		return Consensus{}, err
	}
	var out Consensus
	if err := parseJSON(raw, &out); err != nil || strings.TrimSpace(out.Description) == "" {
		return Consensus{}, fmt.Errorf("consensus: unreadable reply")
	}
	if out.Disputed == nil {
		out.Disputed = []string{}
	}
	return out, nil
}

// Illustrate generates a simple, text-free picture for a concept and returns
// it as a data URL.
func (c *Client) Illustrate(ctx context.Context, concept string) (string, error) {
	if !c.b.Enabled() {
		return "", ErrNotConfigured
	}
	return c.b.Image(ctx, "A clear, friendly educational illustration for a school lesson. Flat vector style, "+
		"calm colours, plain background, no text and no labels, simple enough for a young or "+
		"neurodivergent learner to understand at a glance. Show: "+strings.TrimSpace(concept))
}

// Speech returns spoken audio for text and its MIME type.
func (c *Client) Speech(ctx context.Context, text, lang string) ([]byte, string, error) {
	if !c.b.Enabled() {
		return nil, "", ErrNotConfigured
	}
	return c.b.Speech(ctx, text, lang)
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
