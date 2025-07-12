package id

import (
	"strings"
	"testing"
)

func TestEncodeBase36(t *testing.T) {
	tests := []struct {
		num      int64
		length   int
		expected string
	}{
		{0, 4, "0000"},
		{1, 4, "0001"},
		{35, 2, "0z"},
		{36, 2, "10"},
		{123456789, 8, "021i3v9"},
		{123456789, 2, "21"},
	}

	for _, tt := range tests {
		got := encodeBase36(tt.num, tt.length)
		if len(got) != tt.length {
			t.Errorf("encodeBase36(%d, %d) length = %d, want %d", tt.num, tt.length, len(got), tt.length)
		}
		if tt.num == 0 && got != tt.expected {
			t.Errorf("encodeBase36(%d, %d) = %q, want %q", tt.num, tt.length, got, tt.expected)
		}
	}
}

func TestGenerateBase62(t *testing.T) {
	lengths := []int{1, 5, 10, 32}
	for _, l := range lengths {
		s, err := generateBase62(l)
		if err != nil {
			t.Errorf("generateBase62(%d) returned error: %v", l, err)
		}
		if len(s) != l {
			t.Errorf("generateBase62(%d) = %q (len=%d), want length %d", l, s, len(s), l)
		}
		for i := 0; i < len(s); i++ {
			if !strings.ContainsRune(base62Charset, rune(s[i])) {
				t.Errorf("generateBase62(%d) contains invalid character: %q", l, s[i])
			}
		}
	}
}

func TestGenerateBase62InvalidLength(t *testing.T) {
	_, err := generateBase62(0)
	if err == nil {
		t.Error("generateBase62(0) did not return error for zero length")
	}
	_, err = generateBase62(-5)
	if err == nil {
		t.Error("generateBase62(-5) did not return error for negative length")
	}
}
