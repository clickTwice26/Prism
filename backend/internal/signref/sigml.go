package signref

import (
	"bytes"
	"encoding/xml"
	"errors"
	"io"
	"regexp"
	"strings"
)

// rawSign is one <hns_sign>: its manual HamNoSys symbols, without the "ham"
// prefix, and whether non-manual features (face, mouth) are written.
type rawSign struct {
	Gloss     string
	Symbols   []string
	NonManual bool
}

var (
	errEmpty      = errors.New("empty file")
	errNoSigml    = errors.New("no <sigml> content")
	xmlDecl       = regexp.MustCompile(`<\?xml[^>]*\?>`)
	firstMarkupRe = regexp.MustCompile(`<(sigml|hns_sign)\b`)
)

// readSigml reads a SiGML document leniently. Real-world corpus files may
// have stray text before the XML (the sign written in the HamNoSys font), a
// repeated XML declaration, or several documents glued together; all of
// them are read. Placeholder files with no sign are reported as errors.
func readSigml(data []byte) ([]rawSign, error) {
	if len(bytes.TrimSpace(data)) == 0 {
		return nil, errEmpty
	}
	data = xmlDecl.ReplaceAll(data, nil)
	loc := firstMarkupRe.FindIndex(data)
	if loc == nil {
		return nil, errNoSigml
	}
	body := "<root>" + string(data[loc[0]:]) + "</root>"

	dec := xml.NewDecoder(strings.NewReader(body))
	dec.Strict = false
	dec.AutoClose = xml.HTMLAutoClose

	var (
		signs []rawSign
		cur   *rawSign
		part  string // "manual" | "nonmanual" | ""
	)
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			if len(signs) > 0 {
				break // keep what was read before the damage
			}
			return nil, err
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch name := t.Name.Local; {
			case name == "hns_sign":
				signs = append(signs, rawSign{})
				cur = &signs[len(signs)-1]
				for _, a := range t.Attr {
					if a.Name.Local == "gloss" {
						cur.Gloss = strings.TrimSpace(a.Value)
					}
				}
			case name == "hamnosys_manual":
				part = "manual"
			case name == "hamnosys_nonmanual":
				part = "nonmanual"
			case cur != nil && part == "manual" && strings.HasPrefix(name, "ham"):
				cur.Symbols = append(cur.Symbols, strings.TrimPrefix(name, "ham"))
			case cur != nil && part == "nonmanual":
				cur.NonManual = true
			}
		case xml.EndElement:
			if t.Name.Local == "hamnosys_manual" || t.Name.Local == "hamnosys_nonmanual" {
				part = ""
			}
		}
	}
	// Drop signs with no manual symbols (empty placeholders).
	out := signs[:0]
	for _, s := range signs {
		if len(s.Symbols) > 0 {
			out = append(out, s)
		}
	}
	if len(out) == 0 {
		return nil, errNoSigml
	}
	return out, nil
}
