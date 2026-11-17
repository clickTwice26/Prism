package adapt

import (
	"math/rand/v2"
	"testing"
)

func TestMixKeyRoundTrip(t *testing.T) {
	for _, m := range []Mix{{}, {Simple: true}, {Audio: true, Picture: true}, {true, true, true}} {
		if got := ParseMix(m.Key()); got != m {
			t.Fatalf("%v -> %q -> %v", m, m.Key(), got)
		}
	}
	if (Mix{Simple: true, Picture: true}).Key() != "simple+picture" {
		t.Fatal("unexpected key format")
	}
}

func TestCandidatesRespectWhatALearnerCanPerceive(t *testing.T) {
	for _, m := range Candidates("blind", []string{"original+picture"}) {
		if m.Picture || !m.Audio {
			t.Fatalf("blind learner offered %s", m.Key())
		}
	}
	for _, m := range Candidates("deaf", nil) {
		if m.Audio {
			t.Fatalf("deaf learner offered %s", m.Key())
		}
	}
}

func TestFirstChoiceIsTheProfileDefault(t *testing.T) {
	rng := rand.New(rand.NewPCG(1, 2))
	m, why := Choose(rng, "intellectual_disability", nil)
	if m != Default("intellectual_disability") || why != "starting point for this profile" {
		t.Fatalf("got %s, %q", m.Key(), why)
	}
}

func TestLearnsAMixThatBeatsTheDefault(t *testing.T) {
	// The autism default (simple+picture) keeps failing; simple+audio keeps working.
	stats := map[string][2]int{"simple+picture": {6, 1}, "simple+picture+audio": {2, 1}, "simple+audio": {6, 6}}
	arms := Arms("autism", stats)
	if arms[0].Key != "simple+audio" {
		t.Fatalf("best arm should be simple+audio, got %s", arms[0].Key)
	}
	rng := rand.New(rand.NewPCG(7, 9))
	wins := 0
	for i := 0; i < 500; i++ {
		if m, _ := Choose(rng, "autism", stats); m.Key() == "simple+audio" {
			wins++
		}
	}
	if wins < 350 {
		t.Fatalf("expected simple+audio most of the time, got %d/500", wins)
	}
}

func TestBetaSamplerMean(t *testing.T) {
	rng := rand.New(rand.NewPCG(3, 4))
	sum := 0.0
	for i := 0; i < 20000; i++ {
		sum += sampleBeta(rng, 2, 6)
	}
	if mean := sum / 20000; mean < 0.23 || mean > 0.27 {
		t.Fatalf("Beta(2,6) mean should be 0.25, got %.3f", mean)
	}
}
