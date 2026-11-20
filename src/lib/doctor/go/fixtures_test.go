package doctor

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

var fixturesDir = filepath.Join("..", "spec", "fixtures")

func readFixture(t *testing.T, name string) []byte {
	t.Helper()

	data, err := os.ReadFile(filepath.Join(fixturesDir, name))
	if err != nil {
		t.Fatalf("read fixture %s: %v", name, err)
	}
	return data
}

func decodeJSON(t *testing.T, data []byte) any {
	t.Helper()

	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatalf("decode json: %v", err)
	}
	return value
}

func fixtureNames(t *testing.T, dir string) []string {
	t.Helper()

	matches, err := filepath.Glob(filepath.Join(fixturesDir, dir, "*.json"))
	if err != nil || len(matches) == 0 {
		t.Fatalf("no fixtures in %s: %v", dir, err)
	}

	names := make([]string, len(matches))
	for index, match := range matches {
		names[index] = filepath.Join(dir, filepath.Base(match))
	}
	return names
}
