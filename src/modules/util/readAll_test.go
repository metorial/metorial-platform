package util

import (
	"bytes"
	"errors"
	"strings"
	"testing"
)

// mockReader implements io.Reader and returns an error on Read
type mockReader struct{}

func (m *mockReader) Read(p []byte) (n int, err error) {
	return 0, errors.New("mock read error")
}

func TestReadAll_Success(t *testing.T) {
	input := "hello, world"
	reader := strings.NewReader(input)

	data, err := ReadAll(reader)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if string(data) != input {
		t.Errorf("expected %q, got %q", input, string(data))
	}
}

func TestReadAll_Empty(t *testing.T) {
	reader := bytes.NewReader([]byte{})

	data, err := ReadAll(reader)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(data) != 0 {
		t.Errorf("expected empty slice, got %v", data)
	}
}

func TestReadAll_Error(t *testing.T) {
	reader := &mockReader{}

	data, err := ReadAll(reader)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if data != nil {
		t.Errorf("expected nil data, got %v", data)
	}
	if !strings.Contains(err.Error(), "failed to read data") {
		t.Errorf("expected error to contain 'failed to read data', got %v", err)
	}
}
