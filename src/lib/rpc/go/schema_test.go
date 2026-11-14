package ldrpc

import (
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"testing"
)

type validationVectors struct {
	Types json.RawMessage `json:"types"`
	Cases []struct {
		Method  string          `json:"method"`
		Type    string          `json:"type"`
		Payload string          `json:"payload"`
		Value   *string         `json:"value"`
		Issues  json.RawMessage `json:"issues"`
	} `json:"cases"`
}

// testdata/validation.json holds what @lowerdeck/validation answers for each payload;
// regenerate it with `bun run vectors` in ../spec.
func TestSchemaMatchesTypeScriptValidation(t *testing.T) {
	data, err := os.ReadFile("testdata/validation.json")
	if err != nil {
		t.Fatal(err)
	}
	var vectors validationVectors
	if err := json.Unmarshal(data, &vectors); err != nil {
		t.Fatal(err)
	}

	schemas, err := ParseSchemas(string(vectors.Types))
	if err != nil {
		t.Fatal(err)
	}

	for _, c := range vectors.Cases {
		t.Run(c.Method+" "+c.Payload, func(t *testing.T) {
			got, err := schemas.Type(c.Type).Validate(json.RawMessage(c.Payload))

			if c.Value != nil {
				if err != nil {
					t.Fatalf("TypeScript accepts the payload, Go rejects it: %v", err)
				}
				if !jsonEqual(t, got, []byte(*c.Value)) {
					t.Fatalf("normalized value differs:\n  go: %s\n  ts: %s", got, *c.Value)
				}
				return
			}

			var issues ValidationErrors
			if !errors.As(err, &issues) {
				t.Fatalf("TypeScript rejects the payload with %s, Go returns %s, %v", c.Issues, got, err)
			}
			encoded, err := json.Marshal(issues)
			if err != nil {
				t.Fatal(err)
			}
			if !jsonEqual(t, encoded, c.Issues) {
				t.Fatalf("issues differ:\n  go: %s\n  ts: %s", encoded, c.Issues)
			}
		})
	}
}

func jsonEqual(t *testing.T, a, b []byte) bool {
	t.Helper()

	var x, y any
	if err := json.Unmarshal(a, &x); err != nil {
		t.Fatalf("invalid JSON %s: %v", a, err)
	}
	if err := json.Unmarshal(b, &y); err != nil {
		t.Fatalf("invalid JSON %s: %v", b, err)
	}
	return reflect.DeepEqual(x, y)
}
