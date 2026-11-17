// Package tts runs the Piper command-line synthesizer for offline read-aloud.
package tts

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// Voice model file per language.
var voiceFiles = map[string]string{
	"en": "en_US-lessac-medium.onnx",
	"bn": "bn_BD-google-medium.onnx",
}

type Piper struct {
	bin, voicesDir string
}

func NewPiper(bin, voicesDir string) *Piper { return &Piper{bin: bin, voicesDir: voicesDir} }

// Supports reports whether Piper is installed and has a voice for lang.
func (p *Piper) Supports(lang string) bool {
	if p.bin == "" {
		return false
	}
	f, ok := voiceFiles[lang]
	if !ok {
		return false
	}
	_, err := os.Stat(filepath.Join(p.voicesDir, f))
	return err == nil
}

// Languages lists the languages Piper can speak on this server.
func (p *Piper) Languages() []string {
	out := []string{}
	for lang := range voiceFiles {
		if p.Supports(lang) {
			out = append(out, lang)
		}
	}
	return out
}

// Synthesize returns WAV audio for text.
func (p *Piper) Synthesize(ctx context.Context, text, lang string) ([]byte, error) {
	if !p.Supports(lang) {
		return nil, fmt.Errorf("piper: no voice for %q", lang)
	}
	cmd := exec.CommandContext(ctx, p.bin, "--model", filepath.Join(p.voicesDir, voiceFiles[lang]), "--output_file", "-")
	cmd.Stdin = bytes.NewBufferString(text)
	var out, errBuf bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &errBuf
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("piper: %w: %s", err, errBuf.String())
	}
	return out.Bytes(), nil
}
