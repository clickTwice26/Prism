package ai

import (
	"bytes"
	"context"
	"encoding/base64"
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

func TestGeminiGenerateTextAndJSON(t *testing.T) {
	srv, seen := fakeGemini(t, []map[string]string{{"type": "text", "text": `{"faithful": true, `}, {"type": "text", "text": `"issues": []}`}})
	c := New(NewGemini("k", srv.URL, "gemini-4-hydrogen", "img", "tts", "Kore", "low"))
	fc, err := c.CheckFacts(context.Background(), "a", "b")
	if err != nil || !fc.Faithful {
		t.Fatalf("got %+v, %v", fc, err)
	}
	body := (*seen)[0]
	if body["model"] != "gemini-4-hydrogen" || !strings.Contains(body["system_instruction"].(string), "simplified text") {
		t.Fatalf("bad body: %v", body)
	}
	rf := body["response_format"].(map[string]any)
	cfg := body["generation_config"].(map[string]any)
	if rf["mime_type"] != "application/json" || cfg["thinking_level"] != "low" {
		t.Fatalf("expected JSON response format and low thinking, got %v / %v", rf, cfg)
	}
}

func TestGeminiSendsImageInline(t *testing.T) {
	srv, seen := fakeGemini(t, []map[string]string{{"type": "text", "text": "A leaf."}})
	g := NewGemini("k", srv.URL, "m", "img", "tts", "Kore", "")
	out, err := g.Generate(context.Background(), Request{Text: "Describe", ImageDataURL: "data:image/jpeg;base64,QUJD"})
	if err != nil || out != "A leaf." {
		t.Fatalf("got %q, %v", out, err)
	}
	input := (*seen)[0]["input"].([]any)
	img := input[1].(map[string]any)
	if img["type"] != "image" || img["data"] != "QUJD" || img["mime_type"] != "image/jpeg" {
		t.Fatalf("bad image part: %v", img)
	}
	if _, ok := (*seen)[0]["generation_config"].(map[string]any)["thinking_level"]; ok {
		t.Fatal("thinking_level should be omitted when empty")
	}
}

func TestGeminiImageAndSpeech(t *testing.T) {
	srv, _ := fakeGemini(t, []map[string]string{{"type": "image", "data": "UE5H", "mime_type": "image/png"}})
	url, err := NewGemini("k", srv.URL, "m", "img", "tts", "Kore", "").Image(context.Background(), "a leaf")
	if err != nil || url != "data:image/png;base64,UE5H" {
		t.Fatalf("got %q, %v", url, err)
	}

	pcm := []byte{1, 0, 2, 0}
	srv2, seen := fakeGemini(t, []map[string]string{{"type": "audio", "data": base64.StdEncoding.EncodeToString(pcm), "mime_type": "audio/l16;rate=24000"}})
	audio, mime, err := NewGemini("k", srv2.URL, "m", "img", "tts", "Kore", "").Speech(context.Background(), "হ্যালো", "bn")
	if err != nil || mime != "audio/wav" || !bytes.HasPrefix(audio, []byte("RIFF")) || !bytes.HasSuffix(audio, pcm) {
		t.Fatalf("raw PCM should be wrapped as WAV, got %q %d bytes, %v", mime, len(audio), err)
	}
	if (*seen)[0]["response_format"].(map[string]any)["type"] != "audio" {
		t.Fatalf("speech must ask for audio: %v", (*seen)[0])
	}
}

func TestDescribeSamplesRunInParallelCalls(t *testing.T) {
	srv, seen := fakeGemini(t, []map[string]string{{"type": "text", "text": "A cell."}})
	c := New(NewGemini("k", srv.URL, "m", "img", "tts", "Kore", "low"))
	out, err := c.DescribeImageSamples(context.Background(), "data:image/png;base64,AA", "bn", "short", 3)
	if err != nil || len(out) != 3 || len(*seen) != 3 {
		t.Fatalf("expected 3 samples from 3 calls, got %d samples, %d calls, %v", len(out), len(*seen), err)
	}
}

func TestNoKeyMeansNotConfigured(t *testing.T) {
	c := New(NewGemini("", "http://unused", "m", "img", "tts", "Kore", ""))
	if _, err := c.Translate(context.Background(), "hi", "bn"); err != ErrNotConfigured {
		t.Fatalf("got %v", err)
	}
}
