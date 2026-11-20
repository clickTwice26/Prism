// Package adapt chooses each learner's support mix from their own
// comprehension results (novelty N1).
//
// A mix is a combination of supports for one lesson chunk: simplified text,
// read-aloud, a picture and, for deaf and hard-of-hearing learners, Bangla
// Sign Language (glossary signs for key terms plus the interpreter window). A learner's profile only sets the starting mix.
// After each chunk's question, Thompson sampling over a Beta posterior per mix
// favours the mixes that led to correct answers for this learner, while still
// trying nearby mixes now and then. Accommodation effects differ by student
// (Sireci et al., 2005), and stacking formats can hurt (Albers et al., 2023),
// so the choice is measured per learner rather than fixed by a rule.
package adapt

import (
	"math"
	"math/rand/v2"
	"sort"
	"strings"
)

type Mix struct {
	Simple  bool `json:"simple"`
	Audio   bool `json:"audio"`
	Picture bool `json:"picture"`
	Sign    bool `json:"sign"`
}

// Key is the stored form, e.g. "simple+audio", "original+picture+sign" or "original".
func (m Mix) Key() string {
	parts := []string{"original"}
	if m.Simple {
		parts[0] = "simple"
	}
	if m.Audio {
		parts = append(parts, "audio")
	}
	if m.Picture {
		parts = append(parts, "picture")
	}
	if m.Sign {
		parts = append(parts, "sign")
	}
	return strings.Join(parts, "+")
}

func ParseMix(key string) Mix {
	var m Mix
	for _, p := range strings.Split(key, "+") {
		switch p {
		case "simple":
			m.Simple = true
		case "audio":
			m.Audio = true
		case "picture":
			m.Picture = true
		case "sign":
			m.Sign = true
		}
	}
	return m
}

// Profiles a learner can start from.
var Profiles = []string{
	"blind", "low_vision", "deaf", "hard_of_hearing", "dyslexia",
	"autism", "intellectual_disability", "adhd", "none",
}

func ValidProfile(p string) bool {
	for _, x := range Profiles {
		if x == p {
			return true
		}
	}
	return false
}

// Default is the evidence-based starting mix for a profile.
func Default(profile string) Mix {
	switch profile {
	case "blind", "low_vision", "dyslexia":
		return Mix{Audio: true} // read-aloud: Wood et al., 2017
	case "deaf", "hard_of_hearing":
		// Sign with captions beats either alone (Debevc et al., 2015).
		return Mix{Picture: true, Sign: true}
	case "autism":
		return Mix{Simple: true, Picture: true} // visual supports
	case "intellectual_disability":
		return Mix{Simple: true, Audio: true, Picture: true}
	case "adhd":
		return Mix{Simple: true, Audio: true}
	default:
		return Mix{}
	}
}

// SignProfile reports whether sign is offered to a profile.
func SignProfile(profile string) bool { return profile == "deaf" || profile == "hard_of_hearing" }

// Allowed rules out supports a learner cannot perceive, and offers sign only
// to deaf and hard-of-hearing learners.
func Allowed(profile string, m Mix) bool {
	if m.Sign && !SignProfile(profile) {
		return false
	}
	switch profile {
	case "blind":
		return !m.Picture && m.Audio // must be able to hear the chunk
	case "deaf":
		return !m.Audio
	}
	return true
}

// Candidates are the starting mix, its one-change neighbours and any mix the
// learner has already tried, filtered to what they can perceive.
func Candidates(profile string, tried []string) []Mix {
	start := Default(profile)
	seen := map[string]bool{}
	var out []Mix
	add := func(m Mix) {
		if !seen[m.Key()] && Allowed(profile, m) {
			seen[m.Key()] = true
			out = append(out, m)
		}
	}
	add(start)
	flip := func(f func(*Mix)) Mix { m := start; f(&m); return m }
	add(flip(func(m *Mix) { m.Simple = !m.Simple }))
	add(flip(func(m *Mix) { m.Audio = !m.Audio }))
	add(flip(func(m *Mix) { m.Picture = !m.Picture }))
	add(flip(func(m *Mix) { m.Sign = !m.Sign }))
	for _, k := range tried {
		add(ParseMix(k))
	}
	return out
}

// MinTriesForClaim is how often a mix must be tried before Prism tells a
// teacher it works best for a learner.
const MinTriesForClaim = 3

// Arm is one mix's record for a learner.
type Arm struct {
	Mix      Mix     `json:"mix"`
	Key      string  `json:"key"`
	Tries    int     `json:"tries"`
	Correct  int     `json:"correct"`
	Estimate float64 `json:"estimate"` // posterior mean chance of a correct answer
	Default  bool    `json:"default"`
}

// prior: the profile's starting mix gets a head start of Beta(2,1).
func prior(isDefault bool) (float64, float64) {
	if isDefault {
		return 2, 1
	}
	return 1, 1
}

// Arms lists every candidate mix with its results, best estimate first.
func Arms(profile string, stats map[string][2]int) []Arm {
	tried := make([]string, 0, len(stats))
	for k := range stats {
		tried = append(tried, k)
	}
	sort.Strings(tried)
	def := Default(profile).Key()
	var arms []Arm
	for _, m := range Candidates(profile, tried) {
		s := stats[m.Key()]
		a, b := prior(m.Key() == def)
		arms = append(arms, Arm{
			Mix: m, Key: m.Key(), Tries: s[0], Correct: s[1], Default: m.Key() == def,
			Estimate: (a + float64(s[1])) / (a + b + float64(s[0])),
		})
	}
	sort.SliceStable(arms, func(i, j int) bool { return arms[i].Estimate > arms[j].Estimate })
	return arms
}

// Choose picks the next mix by Thompson sampling and says why in plain words.
func Choose(rng *rand.Rand, profile string, stats map[string][2]int) (Mix, string) {
	arms := Arms(profile, stats)
	total := 0
	for _, a := range arms {
		total += a.Tries
	}
	if total == 0 {
		return Default(profile), "starting point for this profile"
	}
	best, bestDraw := arms[0], -1.0
	for _, arm := range arms {
		a, b := prior(arm.Default)
		draw := sampleBeta(rng, a+float64(arm.Correct), b+float64(arm.Tries-arm.Correct))
		if draw > bestDraw {
			best, bestDraw = arm, draw
		}
	}
	if best.Key == arms[0].Key {
		return best.Mix, "works best so far"
	}
	return best.Mix, "trying a nearby mix"
}

// sampleBeta draws from Beta(a, b) using two Gamma draws.
func sampleBeta(rng *rand.Rand, a, b float64) float64 {
	x, y := sampleGamma(rng, a), sampleGamma(rng, b)
	return x / (x + y)
}

// sampleGamma uses Marsaglia and Tsang's method (shape >= 1, boosted below 1).
func sampleGamma(rng *rand.Rand, shape float64) float64 {
	if shape < 1 {
		return sampleGamma(rng, shape+1) * math.Pow(rng.Float64(), 1/shape)
	}
	d := shape - 1.0/3
	c := 1 / math.Sqrt(9*d)
	for {
		x := rng.NormFloat64()
		v := 1 + c*x
		if v <= 0 {
			continue
		}
		v = v * v * v
		u := rng.Float64()
		if math.Log(u) < 0.5*x*x+d-d*v+d*math.Log(v) {
			return d * v
		}
	}
}
