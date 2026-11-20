package signref

import (
	"strings"
)

// A sign template is a sign broken into the parts a recogniser can check
// against a live signer's skeleton: handshape, orientation, location and a
// sequence of actions. It is parsed from HamNoSys symbols (the SiGML tags
// without their "ham" prefix). See docs/sign-recognition-plan.md.

// HandPose is a hand's shape and orientation.
type HandPose struct {
	Shape   string            `json:"shape,omitempty"`   // fist, flathand, finger2, … (16 base shapes)
	Thumb   string            `json:"thumb,omitempty"`   // across | open | out
	Bend    string            `json:"bend,omitempty"`    // bent | hooked | straight | doublebent | doublehooked (all fingers)
	Fingers map[string]string `json:"fingers,omitempty"` // per-finger bend, e.g. index: bent
	Between *HandPose         `json:"between,omitempty"` // HamNoSys "between": a shape halfway to this one
	Ext     string            `json:"ext,omitempty"`     // extended-finger direction: u, d, l, r, o (out), i (in) and combinations
	Palm    string            `json:"palm,omitempty"`    // palm direction: u, d, l, r and combinations
}

// Location is where the hand is, relative to the body or the other hand.
type Location struct {
	Site       string   `json:"site,omitempty"`             // forehead, chin, chest, shoulders, neutralspace, …
	NondomSite string   `json:"nondominant_site,omitempty"` // where the other hand is, when given separately
	Side       string   `json:"side,omitempty"`             // at | beside (the signer's dominant side)
	Contact    string   `json:"contact,omitempty"`          // touch | close | interlock | cross | behind | between
	Dominant   []string `json:"dominant,omitempty"`         // part of the dominant hand that is placed, e.g. fingertip, index
	Nondom     []string `json:"nondominant,omitempty"`      // part of the other hand it is placed at
	Sequential bool     `json:"sequential,omitempty"`       // given as a sequence of contacts
}

// Action is one step after the starting position.
type Action struct {
	Kind     string    `json:"kind"`              // move, arc, circle, change, hold, fingerplay, nodding, swinging, twisting, wavy, zigzag, stir, ellipse
	Dir      string    `json:"dir,omitempty"`     // u, d, l, r, o, i and combinations
	Size     string    `json:"size,omitempty"`    // small | large
	Contact  string    `json:"contact,omitempty"` // contact made at the end of the action
	Target   *Location `json:"target,omitempty"`  // where the movement goes
	To       *HandPose `json:"to,omitempty"`      // new pose of the dominant hand (kind = change)
	ToNondom *HandPose `json:"to_nondominant,omitempty"`
	Together []Action  `json:"together,omitempty"` // actions done at the same time as this one
}

// Sign is one sign; a word can be a sequence of several.
type Sign struct {
	Hands     string    `json:"hands"` // one | two_mirror | two_parallel | two | nondominant
	Dominant  HandPose  `json:"dominant"`
	Nondom    *HandPose `json:"nondominant,omitempty"`
	Location  Location  `json:"location"`
	Actions   []Action  `json:"actions"`
	Repeat    string    `json:"repeat,omitempty"` // again | several | reverse | continue | continue_several
	Speed     string    `json:"speed,omitempty"`  // fast | slow | tense | decreasing
	NonManual bool      `json:"nonmanual,omitempty"`
	Gaps      []string  `json:"gaps,omitempty"` // symbols the parser could not place
}

// Complete reports whether the sign has every part a recogniser needs: a
// handshape, an orientation and a location. A sign with no actions is held
// still.
func (s Sign) Complete() bool {
	hasLoc := s.Location.Site != "" || len(s.Location.Dominant) > 0 || len(s.Location.Nondom) > 0
	return s.Dominant.Shape != "" && (s.Dominant.Ext != "" || s.Dominant.Palm != "") && hasLoc
}

// ---- symbol classes ----

var shapes = set("fist", "flathand", "finger2", "finger23", "finger23spread", "finger2345",
	"pinch12", "pinch12open", "pinchall", "cee12", "ceeall", "ceeopen")

var thumbMods = map[string]string{"thumbacrossmod": "across", "thumbopenmod": "open", "thumboutmod": "out"}

var bendMods = map[string]string{"fingerbendmod": "bent", "fingerhookmod": "hooked", "fingerstraightmod": "straight",
	"doublebent": "doublebent", "doublehooked": "doublehooked"}

var fingers = map[string]string{"thumb": "thumb", "indexfinger": "index", "middlefinger": "middle",
	"ringfinger": "ring", "pinky": "pinky"}

var sites = set("head", "headtop", "forehead", "eyebrows", "eyes", "nose", "nostrils", "ear", "earlobe",
	"cheek", "lips", "tongue", "teeth", "chin", "underchin", "neck", "shouldertop", "shoulders", "chest",
	"stomach", "belowstomach", "neutralspace")

var handParts = set("fingertip", "fingerpad", "fingernail", "fingermidjoint", "fingerbase", "fingerside",
	"palm", "handback", "wristback", "thumbball", "thumbside", "pinkyside", "lowerarm", "elbowinside", "armextended")

var contacts = map[string]string{"touch": "touch", "close": "close", "interlock": "interlock", "cross": "cross",
	"behind": "behind"}

var motions = map[string]string{"fingerplay": "fingerplay", "nodding": "nodding", "swinging": "swinging",
	"twisting": "twisting", "wavy": "wavy", "zigzag": "zigzag", "stircw": "stir"}

var repeats = map[string]string{"repeatfromstart": "again", "repeatfromstartseveral": "several",
	"repeatreverse": "reverse", "repeatcontinue": "continue", "repeatcontinueseveral": "continue_several"}

var speeds = set("fast", "slow", "tense", "decreasing")

func set(xs ...string) map[string]bool {
	m := make(map[string]bool, len(xs))
	for _, x := range xs {
		m[x] = true
	}
	return m
}

// directed splits "moveor" into ("move", "or") for the directed symbol families.
func directed(t string) (kind, dir string, ok bool) {
	for _, p := range [][2]string{{"move", "move"}, {"arc", "arc"}, {"circle", "circle"}, {"clock", "circle"}, {"ellipse", "ellipse"}} {
		if strings.HasPrefix(t, p[0]) {
			return p[1], strings.TrimPrefix(t, p[0]), true
		}
	}
	return "", "", false
}

func isAction(t string) bool {
	if _, _, ok := directed(t); ok {
		return true
	}
	_, m := motions[t]
	_, r := repeats[t]
	return m || r || t == "nomotion" || t == "replace"
}

// ---- tree ----

// node is a symbol, or a bracketed group: par (parbegin…parend, either two
// hands split by "plus" or simultaneous actions) or seq (seqbegin…seqend).
type node struct {
	sym   string
	group string // "" | par | seq
	kids  []node
}

func buildTree(toks []string) []node {
	var parse func(i int, end string) ([]node, int)
	parse = func(i int, end string) ([]node, int) {
		var out []node
		for i < len(toks) {
			t := toks[i]
			switch t {
			case "parbegin", "seqbegin":
				kids, j := parse(i+1, strings.TrimSuffix(t, "begin")+"end")
				out = append(out, node{group: strings.TrimSuffix(t, "begin"), kids: kids})
				i = j
				continue
			case end:
				return out, i + 1
			case "parend", "seqend":
				i++ // stray closing bracket: drop it
				continue
			}
			out = append(out, node{sym: t})
			i++
		}
		return out, i
	}
	out, _ := parse(0, "")
	return out
}

// split cuts a par group at "plus" into the dominant and non-dominant parts.
func split(kids []node) ([][]node, bool) {
	parts := [][]node{nil}
	for _, k := range kids {
		if k.sym == "plus" {
			parts = append(parts, nil)
			continue
		}
		parts[len(parts)-1] = append(parts[len(parts)-1], k)
	}
	return parts, len(parts) > 1
}

func firstSym(n node) string {
	if n.group == "" {
		return n.sym
	}
	for _, k := range n.kids {
		if s := firstSym(k); s != "" {
			return s
		}
	}
	return ""
}

// ---- parser ----

type parser struct {
	s       *Sign
	acting  bool
	located bool   // orientation done: finger names now mean hand parts
	prev    string // previous symbol placed in a pose
	blend   bool   // "between" two directions: keep the first, skip the next
}

// ParseSign turns one sign's HamNoSys symbols (without the "ham" prefix) into
// a template. Unknown or misplaced symbols are kept in Gaps.
func ParseSign(toks []string, nonManual bool) Sign {
	s := Sign{Hands: "one", NonManual: nonManual, Actions: []Action{}}
	p := &parser{s: &s}
	for _, n := range buildTree(toks) {
		p.top(n)
	}
	if s.Nondom != nil && s.Hands == "one" {
		s.Hands = "two"
	}
	return s
}

func (p *parser) gap(t string) { p.s.Gaps = append(p.s.Gaps, t) }

func (p *parser) top(n node) {
	if n.group != "" && (p.acting || isAction(firstSym(n))) {
		p.acting = true
		p.actionGroup(n)
		return
	}
	if n.group != "" {
		p.configGroup(n)
		return
	}
	switch t := n.sym; {
	case t == "symmlr":
		p.s.Hands = "two_mirror"
	case t == "symmpar":
		p.s.Hands = "two_parallel"
	case t == "nondominant":
		p.s.Hands = "nondominant"
	case p.acting || isAction(t):
		p.acting = true
		p.action(t)
	default:
		p.config(t, &p.s.Dominant, &p.s.Location.Dominant, false)
	}
}

// configGroup handles a bracketed group in the starting position: a
// two-hand split assigns each part to its hand.
func (p *parser) configGroup(n node) {
	parts, twoHands := split(n.kids)
	if !twoHands {
		if n.group == "seq" {
			p.s.Location.Sequential = true
		}
		for _, k := range n.kids {
			p.top(k)
		}
		return
	}
	for i, part := range parts {
		if fl := flatten(part); len(fl) > 0 && shapes[fl[0]] {
			p.located = false // a new hand's shape: finger names are part of it
		}
		pose, loc := &p.s.Dominant, &p.s.Location.Dominant
		if i > 0 {
			if p.s.Nondom == nil {
				p.s.Nondom = &HandPose{}
			}
			pose, loc = p.s.Nondom, &p.s.Location.Nondom
		}
		for _, k := range flatten(part) {
			p.config(k, pose, loc, i > 0)
		}
	}
}

func flatten(ns []node) []string {
	var out []string
	for _, n := range ns {
		if n.group == "" {
			out = append(out, n.sym)
		} else {
			out = append(out, flatten(n.kids)...)
		}
	}
	return out
}

// config places one symbol of the starting position.
func (p *parser) config(t string, pose *HandPose, parts *[]string, nondom bool) {
	loc := &p.s.Location
	isDir := strings.HasPrefix(t, "extfinger") || (strings.HasPrefix(t, "palm") && t != "palm")
	defer func() { p.prev = t }()
	if t == "between" && (strings.HasPrefix(p.prev, "extfinger") || (strings.HasPrefix(p.prev, "palm") && p.prev != "palm")) {
		p.blend = true // halfway between two directions
		return
	}
	if isDir && p.blend {
		p.blend = false
		return
	}
	switch {
	case shapes[t]:
		target := pose
		if pose.Between != nil && pose.Between.Shape == "" {
			target = pose.Between
		}
		if target.Shape == "" {
			target.Shape = t
		} else {
			p.gap(t)
		}
	case t == "between" && !p.located:
		pose.Between = &HandPose{}
	case t == "between":
		loc.Contact = "between"
	case thumbMods[t] != "":
		curPose(pose).Thumb = thumbMods[t]
	case bendMods[t] != "":
		cp := curPose(pose)
		if f := cp.pendingFinger(); f != "" {
			cp.Fingers[f] = bendMods[t]
		} else {
			cp.Bend = bendMods[t]
		}
	case fingers[t] != "" && !p.located:
		cp := curPose(pose)
		if cp.Fingers == nil {
			cp.Fingers = map[string]string{}
		}
		cp.Fingers[fingers[t]] = "" // filled by the next bend modifier
	case strings.HasPrefix(t, "extfinger"):
		pose.Ext = strings.TrimPrefix(t, "extfinger")
		p.located = true
	case strings.HasPrefix(t, "palm") && t != "palm":
		pose.Palm = strings.TrimPrefix(t, "palm")
		p.located = true
	case t == "orirelative":
		// orientation relative to the other hand: keep the absolute values
	case sites[t] && nondom:
		loc.NondomSite = t
		p.located = true
	case sites[t]:
		loc.Site = t
		p.located = true
	case t == "lrat":
		loc.Side = "at"
	case t == "lrbeside":
		loc.Side = "beside"
	case contacts[t] != "":
		loc.Contact = contacts[t]
	case handParts[t], fingers[t] != "":
		name := t
		if f := fingers[t]; f != "" {
			name = f
		}
		*parts = append(*parts, name)
		p.located = true
	case t == "largemod", t == "smallmod":
		// size of a location: ignored
	default:
		p.gap(t)
	}
	pose.dropEmptyFingers()
}

func curPose(pose *HandPose) *HandPose {
	if pose.Between != nil && pose.Between.Shape != "" && pose.Ext == "" && pose.Palm == "" {
		return pose.Between
	}
	return pose
}

func (h *HandPose) pendingFinger() string {
	for f, v := range h.Fingers {
		if v == "" {
			return f
		}
	}
	return ""
}

func (h *HandPose) dropEmptyFingers() {
	if h == nil {
		return
	}
	// A finger named without a bend just marks the selected fingers; keep
	// only those with a modifier once the hand is fully described.
	if h.Ext != "" || h.Palm != "" {
		for f, v := range h.Fingers {
			if v == "" {
				delete(h.Fingers, f)
			}
		}
		if len(h.Fingers) == 0 {
			h.Fingers = nil
		}
	}
	h.Between.dropEmptyFingers()
}

// ---- actions ----

func (p *parser) last() *Action {
	if len(p.s.Actions) == 0 {
		return nil
	}
	return &p.s.Actions[len(p.s.Actions)-1]
}

func (p *parser) action(t string) {
	a := p.last()
	switch {
	case t == "replace":
		p.s.Actions = append(p.s.Actions, Action{Kind: "change", To: &HandPose{}})
	case t == "nomotion":
		p.s.Actions = append(p.s.Actions, Action{Kind: "hold"})
	case repeats[t] != "":
		p.s.Repeat = repeats[t]
	case speeds[t]:
		p.s.Speed = t
	case motions[t] != "":
		p.s.Actions = append(p.s.Actions, Action{Kind: motions[t]})
	case t == "largemod" || t == "smallmod":
		if a != nil {
			a.Size = strings.TrimSuffix(t, "mod")
		}
	default:
		if kind, dir, ok := directed(t); ok {
			p.s.Actions = append(p.s.Actions, Action{Kind: kind, Dir: dir})
			return
		}
		if a == nil {
			p.gap(t)
			return
		}
		p.actionDetail(a, t)
	}
}

// actionDetail attaches a symbol to the current action: a new pose after a
// change, or the place and contact a movement ends at.
func (p *parser) actionDetail(a *Action, t string) {
	if a.Kind == "change" && a.To != nil && (shapes[t] || thumbMods[t] != "" || bendMods[t] != "" ||
		strings.HasPrefix(t, "extfinger") || (strings.HasPrefix(t, "palm") && t != "palm") || t == "between" || t == "orirelative" ||
		(fingers[t] != "" && a.To.Ext == "" && a.To.Palm == "")) {
		var discard []string
		saved := p.located
		p.located = false
		p.config(t, a.To, &discard, false)
		p.located = saved
		return
	}
	switch {
	case contacts[t] != "":
		a.Contact = contacts[t]
	case t == "between":
		// the movement ends between two places, e.g. "cheek between nose"
		if a.Target == nil {
			a.Target = &Location{}
		}
		a.Target.Contact = "between"
	case sites[t] || handParts[t] || fingers[t] != "" || t == "lrat" || t == "lrbeside":
		if a.Target == nil {
			a.Target = &Location{}
		}
		switch {
		case sites[t]:
			a.Target.Site = t
		case t == "lrat":
			a.Target.Side = "at"
		case t == "lrbeside":
			a.Target.Side = "beside"
		default:
			name := t
			if f := fingers[t]; f != "" {
				name = f
			}
			a.Target.Dominant = append(a.Target.Dominant, name)
		}
	default:
		p.gap(t)
	}
}

// actionGroup handles brackets after the starting position: a par without
// "plus" is actions done together; with "plus" it gives each hand its own
// action; a seq is actions one after another.
func (p *parser) actionGroup(n node) {
	parts, twoHands := split(n.kids)
	if n.group == "seq" || (!twoHands && n.group == "par" && len(n.kids) <= 1) {
		for _, k := range n.kids {
			p.top(k)
		}
		return
	}
	if twoHands {
		// Each hand's actions: run the dominant part as normal, then fold the
		// non-dominant part's first action into the dominant one.
		before := len(p.s.Actions)
		for _, k := range parts[0] {
			p.top(k)
		}
		if len(parts) > 1 {
			sub := &parser{s: &Sign{Actions: []Action{}}, acting: true, located: true}
			// The second hand's part may be its new pose after a handshape
			// change, or where it is touched at the end of a movement.
			if l := p.last(); l != nil && !isAction(firstSym(node{group: "seq", kids: parts[1]})) {
				if l.Kind == "change" {
					sub.s.Actions = append(sub.s.Actions, Action{Kind: "change", To: &HandPose{}})
				} else {
					sub.s.Actions = append(sub.s.Actions, Action{Kind: "_place"})
				}
				if len(p.s.Actions) == before {
					before = len(p.s.Actions) - 1 // fold into the action already made
				}
			}
			for _, k := range parts[1] {
				sub.top(k)
			}
			p.s.Gaps = append(p.s.Gaps, sub.s.Gaps...)
			if len(sub.s.Actions) > 0 && len(p.s.Actions) > before {
				first := &p.s.Actions[before]
				for _, a := range sub.s.Actions {
					switch {
					case a.Kind == "change" && a.To != nil && first.Kind == "change" && first.ToNondom == nil:
						first.ToNondom = a.To
					case a.Kind == "_place":
						if a.Target != nil {
							if first.Target == nil {
								first.Target = &Location{}
							}
							first.Target.Nondom = append(first.Target.Nondom, a.Target.Dominant...)
							if a.Target.Site != "" {
								first.Target.NondomSite = a.Target.Site
							}
						}
						if a.Contact != "" && first.Contact == "" {
							first.Contact = a.Contact
						}
					default:
						first.Together = append(first.Together, a)
					}
				}
			}
		}
		return
	}
	// Simultaneous actions: the first leads, the rest happen together with it.
	sub := &parser{s: &Sign{Actions: []Action{}}, acting: true, located: true}
	for _, k := range n.kids {
		sub.top(k)
	}
	p.s.Gaps = append(p.s.Gaps, sub.s.Gaps...)
	if sub.s.Repeat != "" {
		p.s.Repeat = sub.s.Repeat
	}
	if sub.s.Speed != "" {
		p.s.Speed = sub.s.Speed
	}
	if len(sub.s.Actions) == 0 {
		return
	}
	lead := sub.s.Actions[0]
	lead.Together = append(lead.Together, sub.s.Actions[1:]...)
	p.s.Actions = append(p.s.Actions, lead)
}
