package util

import (
	"errors"
	"testing"
)

func TestMust_NoError(t *testing.T) {
	got := Must(42, nil)
	if got != 42 {
		t.Errorf("Must returned %v, want 42", got)
	}
}

func TestMust_WithError(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Errorf("Must did not panic on error")
		}
	}()
	Must("fail", errors.New("some error"))
}
