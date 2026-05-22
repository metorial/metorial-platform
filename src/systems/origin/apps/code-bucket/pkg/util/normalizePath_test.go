package util

import "testing"

func TestNormalizePath(t *testing.T) {
	if got := NormalizePath("foo/../bar/./baz"); got != "/bar/baz" {
		t.Fatalf("NormalizePath() = %q, want /bar/baz", got)
	}

	if got := NormalizePath(""); got != "/" {
		t.Fatalf("NormalizePath(\"\") = %q, want /", got)
	}

	if got := NormalizePath("/a/b/../c"); got != "/a/c" {
		t.Fatalf("NormalizePath() = %q, want /a/c", got)
	}
}
