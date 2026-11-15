package gitlfs

import (
	"strings"
	"testing"
)

func TestFormatPointerRoundTrips(t *testing.T) {
	content := []byte("some large binary content")
	oid := OIDFor(content)

	pointer := FormatPointer(oid, int64(len(content)))

	want := "version https://git-lfs.github.com/spec/v1\noid sha256:" + oid + "\nsize 25\n"
	if string(pointer) != want {
		t.Fatalf("unexpected pointer body:\n%q\nwant:\n%q", pointer, want)
	}

	parsed, ok := ParsePointer(pointer)
	if !ok {
		t.Fatal("expected pointer to parse")
	}
	if parsed.OID != oid {
		t.Fatalf("unexpected oid: %q", parsed.OID)
	}
	if parsed.Size != int64(len(content)) {
		t.Fatalf("unexpected size: %d", parsed.Size)
	}
	if string(parsed.Bytes()) != want {
		t.Fatalf("Bytes did not round-trip: %q", parsed.Bytes())
	}
}

func TestParsePointerRejectsNonPointers(t *testing.T) {
	oid := strings.Repeat("a", 64)

	cases := map[string][]byte{
		"empty":          nil,
		"plain text":     []byte("hello world\n"),
		"missing size":   []byte("version https://git-lfs.github.com/spec/v1\noid sha256:" + oid + "\n"),
		"bad oid algo":   []byte("version https://git-lfs.github.com/spec/v1\noid sha1:" + oid + "\nsize 3\n"),
		"short oid":      []byte("version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 3\n"),
		"version second": []byte("oid sha256:" + oid + "\nversion https://git-lfs.github.com/spec/v1\nsize 3\n"),
		"bad size":       []byte("version https://git-lfs.github.com/spec/v1\noid sha256:" + oid + "\nsize huge\n"),
		"blank line":     []byte("version https://git-lfs.github.com/spec/v1\n\noid sha256:" + oid + "\nsize 3\n"),
		"too long":       []byte("version https://git-lfs.github.com/spec/v1\noid sha256:" + oid + "\nsize 3\n" + strings.Repeat("x", MaxPointerSize)),
	}

	for name, content := range cases {
		if _, ok := ParsePointer(content); ok {
			t.Errorf("%s: expected parse to fail", name)
		}
	}
}

func TestLooksLikePointer(t *testing.T) {
	oid := strings.Repeat("b", 64)
	pointer := FormatPointer(oid, 10)

	if !LooksLikePointer(pointer) {
		t.Fatal("expected pointer to be recognised")
	}
	if LooksLikePointer([]byte("version 1\n")) {
		t.Fatal("expected non-pointer to be rejected")
	}
	if LooksLikePointer(make([]byte, MaxPointerSize+1)) {
		t.Fatal("expected oversized content to be rejected")
	}
}
