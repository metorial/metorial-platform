package util

import (
	"errors"
	"testing"
)

func TestMapWithError_IntToString_Success(t *testing.T) {
	input := []int{1, 2, 3}
	mapFunc := func(i int) (string, error) {
		return string(rune('a' + i)), nil
	}
	expected := []string{"b", "c", "d"}

	output, err := MapWithError(input, mapFunc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(output) != len(expected) {
		t.Fatalf("expected length %d, got %d", len(expected), len(output))
	}
	for i := range output {
		if output[i] != expected[i] {
			t.Errorf("at index %d: expected %q, got %q", i, expected[i], output[i])
		}
	}
}

func TestMapWithError_ErrorOnElement(t *testing.T) {
	input := []int{1, 2, 3}
	mapFunc := func(i int) (string, error) {
		if i == 2 {
			return "", errors.New("error on 2")
		}
		return string(rune('a' + i)), nil
	}

	output, err := MapWithError(input, mapFunc)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if output != nil {
		t.Errorf("expected output to be nil on error, got %v", output)
	}
}

func TestMapWithError_EmptyInput(t *testing.T) {
	input := []int{}
	mapFunc := func(i int) (string, error) {
		return string(rune('a' + i)), nil
	}

	output, err := MapWithError(input, mapFunc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(output) != 0 {
		t.Errorf("expected empty output, got %v", output)
	}
}

func TestMapWithError_NilInput(t *testing.T) {
	var input []int = nil
	mapFunc := func(i int) (string, error) {
		return string(rune('a' + i)), nil
	}

	output, err := MapWithError(input, mapFunc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if output != nil {
		t.Errorf("expected nil output, got %v", output)
	}
}
