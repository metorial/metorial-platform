package util

import (
	"strconv"
	"testing"
)

func TestMap_IntToString(t *testing.T) {
	input := []int{1, 2, 3}
	expected := []string{"1", "2", "3"}
	result := Map(input, func(i int) string {
		return strconv.Itoa(i)
	})
	if len(result) != len(expected) {
		t.Fatalf("expected length %d, got %d", len(expected), len(result))
	}
	for i := range expected {
		if result[i] != expected[i] {
			t.Errorf("at index %d: expected %q, got %q", i, expected[i], result[i])
		}
	}
}

func TestMap_EmptyInput(t *testing.T) {
	input := []int{}
	result := Map(input, func(i int) int { return i * 2 })
	if len(result) != 0 {
		t.Errorf("expected empty slice, got %v", result)
	}
}

func TestMap_NilInput(t *testing.T) {
	var input []int = nil
	result := Map(input, func(i int) int { return i * 2 })
	if result != nil {
		t.Errorf("expected nil, got %v", result)
	}
}

func TestMap_StringToLen(t *testing.T) {
	input := []string{"foo", "bar", "baz"}
	expected := []int{3, 3, 3}
	result := Map(input, func(s string) int { return len(s) })
	for i := range expected {
		if result[i] != expected[i] {
			t.Errorf("at index %d: expected %d, got %d", i, expected[i], result[i])
		}
	}
}
