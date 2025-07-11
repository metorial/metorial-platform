package id

import (
	"testing"
)

func TestGenerateID_ValidLength(t *testing.T) {
	length := 16
	id, err := GenerateID(length)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(id) != length {
		t.Errorf("expected id length %d, got %d", length, len(id))
	}
}

func TestGenerateID_MinimumLength(t *testing.T) {
	// timestampLength is 10, so minimum valid length is 12
	length := timestampLength + 2
	id, err := GenerateID(length)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(id) != length {
		t.Errorf("expected id length %d, got %d", length, len(id))
	}
}

func TestGenerateID_TooShortLength(t *testing.T) {
	length := timestampLength // too short
	_, err := GenerateID(length)
	if err == nil {
		t.Fatal("expected error for too short length, got nil")
	}
}

func TestGenerateID_EncodedTimestamp(t *testing.T) {
	length := 20
	id, err := GenerateID(length)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	encodedTimestamp := id[:timestampLength]
	if len(encodedTimestamp) != timestampLength {
		t.Errorf("expected encoded timestamp length %d, got %d", timestampLength, len(encodedTimestamp))
	}
	// Should be base36 (digits and lowercase letters)
	if !isBase36(encodedTimestamp) {
		t.Errorf("encoded timestamp %q is not base36", encodedTimestamp)
	}
}

func isBase36(s string) bool {
	for _, r := range s {
		if !(r >= '0' && r <= '9') && !(r >= 'a' && r <= 'z') {
			return false
		}
	}
	return true
}

// Optionally, test uniqueness
func TestGenerateID_Uniqueness(t *testing.T) {
	ids := make(map[string]struct{})
	for i := 0; i < 1000; i++ {
		id, err := GenerateID(16)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if _, exists := ids[id]; exists {
			t.Fatalf("duplicate id generated: %s", id)
		}
		ids[id] = struct{}{}
	}
}

// Optionally, test that random part is base62
func TestGenerateID_RandomPartBase62(t *testing.T) {
	length := 18
	id, err := GenerateID(length)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	randomPart := id[timestampLength:]
	if !isBase62(randomPart) {
		t.Errorf("random part %q is not base62", randomPart)
	}
}

func isBase62(s string) bool {
	for _, r := range s {
		if !(r >= '0' && r <= '9') && !(r >= 'a' && r <= 'z') && !(r >= 'A' && r <= 'Z') {
			return false
		}
	}
	return true
}
