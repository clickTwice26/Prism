package signref

import (
	"strings"
	"testing"
)

func parse(sym string) Sign { return ParseSign(strings.Fields(sym), false) }

// জ্বর (fever) in IsharaKotha: flat hand at the forehead, ring-finger pad touching it.
func TestFeverIsAOneHandedSignAtTheForehead(t *testing.T) {
	s := parse("flathand extfingerl palml forehead seqbegin touch fingerpad ringfinger seqend")
	if s.Hands != "one" || s.Dominant.Shape != "flathand" || s.Dominant.Ext != "l" || s.Dominant.Palm != "l" {
		t.Fatalf("bad pose: %+v", s)
	}
	if s.Location.Site != "forehead" || s.Location.Contact != "touch" || !s.Location.Sequential {
		t.Fatalf("bad location: %+v", s.Location)
	}
	if got := strings.Join(s.Location.Dominant, ","); got != "fingerpad,ring" {
		t.Fatalf("contact point = %q", got)
	}
	if !s.Complete() || len(s.Gaps) > 0 {
		t.Fatalf("should be complete without gaps: %+v", s)
	}
}

// ডাক্তার (doctor): each hand has its own shape and orientation, and the
// dominant hand's wrist back meets the other hand's pinky pad at the chest.
func TestDoctorSplitsShapeAndLocationPerHand(t *testing.T) {
	s := parse("symmpar parbegin flathand fingerbendmod extfingerl palmd plus fist extfingero palmu parend " +
		"parbegin wristback plus fingerpad pinky parend touch lrat chest close")
	if s.Hands != "two_parallel" || s.Nondom == nil {
		t.Fatalf("expected two hands: %+v", s)
	}
	if s.Dominant.Shape != "flathand" || s.Dominant.Bend != "bent" || s.Dominant.Palm != "d" {
		t.Fatalf("dominant: %+v", s.Dominant)
	}
	if s.Nondom.Shape != "fist" || s.Nondom.Ext != "o" || s.Nondom.Palm != "u" {
		t.Fatalf("non-dominant: %+v", s.Nondom)
	}
	if strings.Join(s.Location.Dominant, ",") != "wristback" || strings.Join(s.Location.Nondom, ",") != "fingerpad,pinky" {
		t.Fatalf("contact points: %+v", s.Location)
	}
	if s.Location.Site != "chest" || s.Location.Side != "at" || len(s.Actions) != 0 || !s.Complete() {
		t.Fatalf("static sign at the chest expected: %+v", s)
	}
}

// পানি (water): per-finger bends and a handshape change moving from the shoulder to the lips.
func TestWaterKeepsFingerBendsAndTheChange(t *testing.T) {
	s := parse("flathand thumbopenmod between flathand thumbopenmod indexfinger fingerbendmod middlefinger fingerbendmod " +
		"ringfinger fingerbendmod pinky fingerbendmod extfingero palml shoulders seqbegin close fingernail thumb seqend " +
		"replace flathand thumbopenmod extfingeru palml lips")
	if s.Dominant.Between == nil || s.Dominant.Between.Fingers["index"] != "bent" || s.Dominant.Between.Fingers["pinky"] != "bent" {
		t.Fatalf("finger bends lost: %+v", s.Dominant)
	}
	if len(s.Actions) != 1 || s.Actions[0].Kind != "change" || s.Actions[0].To.Ext != "u" {
		t.Fatalf("change lost: %+v", s.Actions)
	}
	if tgt := s.Actions[0].Target; tgt == nil || tgt.Site != "lips" {
		t.Fatalf("the change should end at the lips: %+v", s.Actions[0])
	}
}

// নাচা (dance): after a handshape change, each hand gets its own orientation.
func TestChangeGivesEachHandItsOwnOrientation(t *testing.T) {
	s := parse("symmpar finger2345 thumboutmod extfingeru parbegin palmd plus palmr parend parbegin head lrat plus chest lrat parend " +
		"replace finger23spread thumboutmod parbegin palmu plus extfingerr palmu parend")
	if s.Location.Site != "head" || s.Location.NondomSite != "chest" {
		t.Fatalf("each hand's place: %+v", s.Location)
	}
	c := s.Actions[len(s.Actions)-1]
	if c.Kind != "change" || c.To.Shape != "finger23spread" || c.To.Palm != "u" {
		t.Fatalf("dominant change: %+v", c)
	}
	if c.ToNondom == nil || c.ToNondom.Ext != "r" || c.ToNondom.Palm != "u" {
		t.Fatalf("non-dominant change: %+v", c.ToNondom)
	}
	if len(s.Gaps) > 0 {
		t.Fatalf("unexpected gaps %v", s.Gaps)
	}
}

func TestMovementSizeRepeatAndSimultaneousActions(t *testing.T) {
	s := parse("flathand thumboutmod extfingeru palmd shouldertop lrat close parbegin moveor largemod replace extfingeror palml parend repeatfromstart")
	if len(s.Actions) != 1 {
		t.Fatalf("simultaneous actions should be one step: %+v", s.Actions)
	}
	a := s.Actions[0]
	if a.Kind != "move" || a.Dir != "or" || a.Size != "large" || len(a.Together) != 1 || a.Together[0].Kind != "change" {
		t.Fatalf("bad step: %+v", a)
	}
	if s.Repeat != "again" {
		t.Fatalf("repeat = %q", s.Repeat)
	}
}

func TestDirectionBetweenTwoDirectionsKeepsTheFirst(t *testing.T) {
	s := parse("pinchall fingerstraightmod extfingero between extfingerl palmu chest")
	if s.Dominant.Ext != "o" || s.Dominant.Palm != "u" || len(s.Gaps) > 0 {
		t.Fatalf("got %+v gaps %v", s.Dominant, s.Gaps)
	}
}

func TestReadSigmlIsLenient(t *testing.T) {
	glued := `<?xml version="1.0"?><sigml><hns_sign gloss="a"><hamnosys_nonmanual/><hamnosys_manual><hamfist/><hamextfingeru/><hampalml/><hamchest/></hamnosys_manual></hns_sign></sigml>
<?xml version="1.0"?><sigml><hns_sign><hamnosys_nonmanual><hamhead/></hamnosys_nonmanual><hamnosys_manual><hamflathand/></hamnosys_manual></hns_sign></sigml>`
	signs, err := readSigml([]byte(" " + glued))
	if err != nil || len(signs) != 2 || signs[0].Gloss != "a" || signs[1].Symbols[0] != "flathand" || !signs[1].NonManual {
		t.Fatalf("got %+v, %v", signs, err)
	}
	for _, bad := range []string{"", "   ", "Content for file 13"} {
		if _, err := readSigml([]byte(bad)); err == nil {
			t.Fatalf("%q should be an error", bad)
		}
	}
}
