package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

// fakeGemini records each request and answers with the given step content.
func fakeGemini(t *testing.T, content []map[string]string) (*httptest.Server, *[]map[string]any) {
	t.Helper()
	var seen []map[string]any
	var mu sync.Mutex
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/interactions" || r.Method != http.MethodPost {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("x-goog-api-key") != "k" || r.Header.Get("Api-Revision") != GeminiAPIRevision {
			t.Errorf("missing key or revision headers: %v", r.Header)
		}
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		mu.Lock()
		seen = append(seen, body)
		mu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":    "int_1",
			"steps": []map[string]any{{"type": "thought"}, {"type": "model_output", "content": content}},
		})
	}))
	t.Cleanup(srv.Close)
	return srv, &seen
}

func TestKeyTermsAsksForJSONAndKeepsTermsInTheLessonLanguage(t *testing.T) {
	srv, seen := fakeGemini(t, []map[string]string{
		{"type": "text", "text": `{"terms":[{"en":"chlorophyll","bn":"ক্লোরোফিল","ms":"klorofil"},`},
		{"type": "text", "text": `{"bn":"শুধু বাংলা"}]}`},
	})
	c := New(NewGemini("k", srv.URL, "gemini-4-hydrogen", "low"))
	terms, err := c.KeyTerms(context.Background(), "Chlorophyll absorbs light.", "en")
	if err != nil || len(terms) != 1 || terms[0]["bn"] != "ক্লোরোফিল" {
		t.Fatalf("a term without an English label should be dropped: %+v, %v", terms, err)
	}
	body := (*seen)[0]
	if body["model"] != "gemini-4-hydrogen" || !strings.Contains(body["system_instruction"].(string), "sign language glossary") {
		t.Fatalf("bad body: %v", body)
	}
	rf := body["response_format"].(map[string]any)
	cfg := body["generation_config"].(map[string]any)
	if rf["mime_type"] != "application/json" || cfg["thinking_level"] != "low" {
		t.Fatalf("expected JSON response format and low thinking, got %v / %v", rf, cfg)
	}
}

func TestThinkingLevelOmittedWhenEmpty(t *testing.T) {
	srv, seen := fakeGemini(t, []map[string]string{{"type": "text", "text": "পাতা"}})
	out, err := New(NewGemini("k", srv.URL, "m", "")).Translate(context.Background(), "leaf", "bn")
	if err != nil || out != "পাতা" {
		t.Fatalf("got %q, %v", out, err)
	}
	if _, ok := (*seen)[0]["generation_config"].(map[string]any)["thinking_level"]; ok {
		t.Fatal("thinking_level should be omitted when empty")
	}
}

func TestNoKeyMeansNotConfigured(t *testing.T) {
	c := New(NewGemini("", "http://unused", "m", ""))
	if _, err := c.Translate(context.Background(), "hi", "bn"); err != ErrNotConfigured {
		t.Fatalf("got %v", err)
	}
}
