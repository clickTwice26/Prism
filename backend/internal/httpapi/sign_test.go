package httpapi

import "testing"

func TestSniffVideo(t *testing.T) {
	cases := []struct {
		head []byte
		mime string
		ok   bool
	}{
		{[]byte{0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42}, "video/webm", true},
		{[]byte("\x00\x00\x00\x20ftypisom"), "video/mp4", true},
		{[]byte("<html><script>"), "", false},
		{[]byte{0xFF, 0xD8, 0xFF}, "", false},
	}
	for _, c := range cases {
		mime, _, ok := sniffVideo(c.head)
		if ok != c.ok || mime != c.mime {
			t.Fatalf("%q: got %q %v", c.head, mime, ok)
		}
	}
}

func TestMediaNamesCannotEscapeTheFolder(t *testing.T) {
	if !mediaName.MatchString(randomName("webm")) {
		t.Fatal("generated names must be servable")
	}
	for _, bad := range []string{"../x.webm", "a.webm", "0123456789abcdef0123456789abcdef.html"} {
		if mediaName.MatchString(bad) {
			t.Fatalf("%q should be refused", bad)
		}
	}
}
