// Package textkit has offline text tools: an English reading-level estimate
// and a conservative rule-based simplifier used when AI is unavailable.
package textkit

import (
	"regexp"
	"sort"
	"strings"
	"unicode"
)

var (
	nonAlpha    = regexp.MustCompile(`[^a-z]`)
	syllStrip   = regexp.MustCompile(`(?:[^laeiouy]es|ed|[^laeiouy]e)$`)
	leadingY    = regexp.MustCompile(`^y`)
	vowelGroups = regexp.MustCompile(`[aeiouy]{1,2}`)
	sentences   = regexp.MustCompile(`[^.!?]+[.!?]*`)
)

func countSyllables(word string) int {
	w := nonAlpha.ReplaceAllString(strings.ToLower(word), "")
	if w == "" {
		return 0
	}
	if len(w) <= 3 {
		return 1
	}
	w = leadingY.ReplaceAllString(syllStrip.ReplaceAllString(w, ""), "")
	if n := len(vowelGroups.FindAllString(w, -1)); n > 0 {
		return n
	}
	return 1
}

// GradeLevel returns a Flesch-Kincaid grade for English text. The formula is
// built on English syllable patterns, so it returns nil for other languages
// rather than a meaningless number.
func GradeLevel(text, lang string) *int {
	if lang != "en" || strings.TrimSpace(text) == "" {
		return nil
	}
	sc := 0
	for _, s := range sentences.FindAllString(text, -1) {
		if strings.TrimSpace(s) != "" {
			sc++
		}
	}
	if sc == 0 {
		sc = 1
	}
	words := strings.Fields(text)
	if len(words) == 0 {
		return nil
	}
	syll := 0
	for _, w := range words {
		syll += countSyllables(w)
	}
	g := 0.39*float64(len(words))/float64(sc) + 11.8*float64(syll)/float64(len(words)) - 15.59
	n := int(g + 0.5)
	if n < 1 {
		n = 1
	}
	return &n
}

// Plain-word swaps that keep meaning. Domain terms (radiation, incident,
// mechanism, …) are deliberately absent: swapping them changes facts.
var replacements = map[string]string{
	"utilize": "use", "utilise": "use", "approximately": "about", "demonstrate": "show",
	"demonstrated": "showed", "subsequently": "later", "consequently": "so", "sufficient": "enough",
	"numerous": "many", "additional": "more", "facilitate": "help", "require": "need",
	"requires": "needs", "obtain": "get", "commence": "start", "terminate": "end", "assist": "help",
	"endeavour": "try", "endeavor": "try", "prior to": "before", "in order to": "to",
	"regarding": "about", "purchase": "buy", "initiate": "start", "notwithstanding": "despite",
}

var (
	replacePatterns []struct {
		re   *regexp.Regexp
		with string
	}
	conjunctions = regexp.MustCompile(`(?i),?\s+(but|so|because|although|however|whereas|therefore|moreover|furthermore)\s+`)
	semicolon    = regexp.MustCompile(`\s*;\s*`)
	splitSent    = regexp.MustCompile(`([.!?])\s+`)
)

func init() {
	keys := make([]string, 0, len(replacements))
	for k := range replacements {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool { return len(keys[i]) > len(keys[j]) })
	for _, k := range keys {
		replacePatterns = append(replacePatterns, struct {
			re   *regexp.Regexp
			with string
		}{regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(k) + `\b`), replacements[k]})
	}
}

// Simplify is the offline fallback for English: plain-word swaps and sentence
// splitting only. Other languages are returned unchanged.
func Simplify(text, lang string) string {
	text = strings.TrimSpace(text)
	if text == "" || lang != "en" {
		return text
	}
	for _, p := range replacePatterns {
		text = p.re.ReplaceAllString(text, p.with)
	}
	text = semicolon.ReplaceAllString(text, ". ")
	text = conjunctions.ReplaceAllString(text, ". $1 ")
	text = splitSent.ReplaceAllString(text, "$1\n")

	var out []string
	for _, s := range strings.Split(text, "\n") {
		s = strings.Trim(strings.TrimSpace(s), ",;: ")
		if s == "" {
			continue
		}
		s = strings.TrimRight(s, ".!?")
		r := []rune(s)
		r[0] = unicode.ToUpper(r[0])
		out = append(out, string(r)+".")
	}
	return strings.Join(out, " ")
}
