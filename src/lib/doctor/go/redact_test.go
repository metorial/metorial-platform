package doctor

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"unicode/utf8"
)

func TestRedactionVectors(t *testing.T) {
	var vectors []struct {
		Name     string `json:"name"`
		Input    any    `json:"input"`
		Expected any    `json:"expected"`
	}
	if err := json.Unmarshal(readFixture(t, "redaction.json"), &vectors); err != nil {
		t.Fatal(err)
	}

	for _, vector := range vectors {
		t.Run(vector.Name, func(t *testing.T) {
			actual := Redact(vector.Input)
			if !reflect.DeepEqual(actual, vector.Expected) {
				t.Fatalf("got %#v, want %#v", actual, vector.Expected)
			}
		})
	}
}

func TestRedactStringCapsLength(t *testing.T) {
	input := strings.Repeat("é", 3000)
	actual := RedactString(input)

	if !strings.HasSuffix(actual, "…[truncated]") {
		t.Fatalf("missing truncation suffix")
	}
	if count := utf8.RuneCountInString(strings.TrimSuffix(actual, "…[truncated]")); count != 2048 {
		t.Fatalf("kept %d code points, want 2048", count)
	}
	if RedactString(strings.Repeat("a", 2048)) != strings.Repeat("a", 2048) {
		t.Fatalf("a string of exactly 2048 code points must not be cut")
	}
}

func TestRedactConvertsGoValues(t *testing.T) {
	type nested struct {
		Host     string `json:"host"`
		Password string `json:"password"`
	}

	actual := Redact(map[string]any{
		"config": nested{Host: "db", Password: "hunter2"},
		"count":  3,
		"none":   (*nested)(nil),
	})
	expected := map[string]any{
		"config": map[string]any{"host": "db", "password": "***"},
		"count":  3,
		"none":   nil,
	}

	if !reflect.DeepEqual(actual, expected) {
		t.Fatalf("got %#v, want %#v", actual, expected)
	}
}

func TestIsSecretKey(t *testing.T) {
	for key, want := range map[string]bool{
		"password": true, "DB_PASSWORD": true, "x-api-key": true, "apiKey": true,
		"pwd": true, "auth": true, "Authorization": true, "sessionToken": true,
		"author": false, "passive": false, "host": false, "keyId": false,
	} {
		if got := IsSecretKey(key); got != want {
			t.Errorf("IsSecretKey(%q) = %v, want %v", key, got, want)
		}
	}
}
