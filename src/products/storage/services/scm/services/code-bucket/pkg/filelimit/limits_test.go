package filelimit

import (
	"errors"
	"strings"
	"testing"
)

func TestFileTooLargeErrorIsRecognisable(t *testing.T) {
	err := FileTooLargeError("GitHub", "assets/big.bin", 4<<30, 2<<30)

	if !errors.Is(err, ErrFileTooLarge) {
		t.Fatal("callers cannot tell an oversized file from any other failure")
	}

	for _, want := range []string{"assets/big.bin", "4.0 GiB", "2.0 GiB", "GitHub"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error is missing %q: %v", want, err)
		}
	}
}

func TestFileTooLargeErrorDoesNotMatchOtherFailures(t *testing.T) {
	if errors.Is(errors.New("connection reset"), ErrFileTooLarge) {
		t.Fatal("an unrelated error matched the size sentinel")
	}
}

func TestHumanBytes(t *testing.T) {
	for _, tc := range []struct {
		size int64
		want string
	}{
		{0, "0 B"},
		{512, "512 B"},
		{1024, "1.0 KiB"},
		{100 << 20, "100.0 MiB"},
		{2 << 30, "2.0 GiB"},
	} {
		if got := HumanBytes(tc.size); got != tc.want {
			t.Errorf("HumanBytes(%d) = %q, want %q", tc.size, got, tc.want)
		}
	}
}
