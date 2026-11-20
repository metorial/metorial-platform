package doctor

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestValidReportsRoundTrip(t *testing.T) {
	for _, name := range fixtureNames(t, "reports") {
		t.Run(name, func(t *testing.T) {
			data := readFixture(t, name)

			report, err := ParseReport(data)
			if err != nil {
				t.Fatal(err)
			}

			encoded, err := json.Marshal(report)
			if err != nil {
				t.Fatal(err)
			}

			if !reflect.DeepEqual(decodeJSON(t, encoded), decodeJSON(t, data)) {
				t.Fatalf("round trip changed the report:\n%s", encoded)
			}
		})
	}
}

func TestInvalidReportsAreRejected(t *testing.T) {
	for _, name := range fixtureNames(t, "invalid") {
		t.Run(name, func(t *testing.T) {
			if _, err := ParseReport(readFixture(t, name)); err == nil {
				t.Fatal("expected an error")
			}
		})
	}
}

func TestParseReportAcceptsAbsentOptionalFields(t *testing.T) {
	report, err := ParseReport([]byte(`{
		"doctor": 1,
		"component": "gateway",
		"instance": "gateway-0",
		"processStartedAt": "2026-11-17T10:00:00.000Z",
		"startedAt": "2026-11-17T10:00:00.000Z",
		"generatedAt": "2026-11-17T10:00:00.000Z",
		"durationMs": 0,
		"runId": "abc",
		"future": true,
		"checks": [{
			"id": "db.reachable", "title": "Database", "category": "database",
			"status": "pass", "severity": "critical", "durationMs": 1, "message": "OK"
		}]
	}`))
	if err != nil {
		t.Fatal(err)
	}

	encoded, _ := json.Marshal(report)
	decoded := decodeJSON(t, encoded).(map[string]any)

	for _, key := range []string{"releaseVersion", "buildVersion", "channel", "publicUrl"} {
		if value, ok := decoded[key]; !ok || value != nil {
			t.Errorf("%s = %v, want null", key, value)
		}
	}

	check := decoded["checks"].([]any)[0].(map[string]any)
	for _, key := range []string{"target", "resolution", "details", "cachedAt"} {
		if value, ok := check[key]; !ok || value != nil {
			t.Errorf("checks.0.%s = %v, want null", key, value)
		}
	}
}

func TestResolutionStepsAlwaysArray(t *testing.T) {
	encoded, _ := json.Marshal(Resolution{Summary: "Fix it"})
	if string(encoded) != `{"summary":"Fix it","steps":[],"docs":null}` {
		t.Fatalf("got %s", encoded)
	}
}
