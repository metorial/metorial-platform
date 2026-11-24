package issue

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/sentry"
)

func parse(t *testing.T, payload string) *sentry.Event {
	t.Helper()
	event, err := sentry.ParseEvent([]byte(payload))
	if err != nil {
		t.Fatal(err)
	}
	return event
}

func exceptionEvent(value string, line int, function string) string {
	return `{"exception":{"values":[{"type":"TypeError","value":"` + value + `","stacktrace":{"frames":[
		{"filename":"/app/node_modules/pg/lib/client.js","function":"Client.query","lineno":10,"in_app":false},
		{"filename":"/app/dist/main.mjs?v=1","function":"` + function + `","lineno":` + itoa(line) + `,"colno":4,"in_app":true}
	]}}]}}`
}

func itoa(value int) string {
	b, _ := json.Marshal(value)
	return string(b)
}

func TestGroupingIgnoresLineNumbersAndMessages(t *testing.T) {
	first := Hash("worker", parse(t, exceptionEvent("user usr_0123456789abc not found", 120, "loadUser")))
	second := Hash("worker", parse(t, exceptionEvent("user usr_zyxwvutsrq987 not found", 9120, "loadUser")))
	if first != second {
		t.Errorf("same function on different lines grouped apart: %s != %s", first, second)
	}

	if other := Hash("worker", parse(t, exceptionEvent("x", 120, "saveUser"))); other == first {
		t.Error("different functions grouped together")
	}
	if other := Hash("core-api", parse(t, exceptionEvent("x", 120, "loadUser"))); other == first {
		t.Error("different components grouped together")
	}
}

func TestGroupingWithoutStacktraceNormalizesTheValue(t *testing.T) {
	first := Hash("worker", parse(t, `{"exception":{"values":[{"type":"Error","value":"Timeout after 3000ms for 0b3c6a1e-1d2f-4a5b-8c9d-0e1f2a3b4c5d"}]}}`))
	second := Hash("worker", parse(t, `{"exception":{"values":[{"type":"Error","value":"Timeout after 5000ms for 9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f"}]}}`))
	if first != second {
		t.Error("normalized values grouped apart")
	}

	messageA := Hash("worker", parse(t, `{"message":{"message":"Job %s failed","formatted":"Job 1 failed"}}`))
	messageB := Hash("worker", parse(t, `{"message":{"message":"Job %s failed","formatted":"Job 2 failed"}}`))
	if messageA != messageB {
		t.Error("message templates grouped apart")
	}
}

func TestFingerprintExpandsDefault(t *testing.T) {
	base := exceptionEvent("x", 1, "run")
	withFingerprint := strings.Replace(base, `{"exception"`, `{"fingerprint":["{{ default }}","queue-email"],"exception"`, 1)
	plainFingerprint := strings.Replace(base, `{"exception"`, `{"fingerprint":["queue-email"],"exception"`, 1)

	defaultHash := Hash("worker", parse(t, base))
	expanded := Hash("worker", parse(t, withFingerprint))
	plain := Hash("worker", parse(t, plainFingerprint))

	if expanded == defaultHash || expanded == plain || plain == defaultHash {
		t.Errorf("fingerprints did not split groups: %s %s %s", defaultHash, expanded, plain)
	}

	otherFunction := strings.Replace(plainFingerprint, `"function":"run"`, `"function":"other"`, 1)
	if Hash("worker", parse(t, otherFunction)) != plain {
		t.Error("a fingerprint without {{ default }} should ignore the stack trace")
	}
}

func TestScrub(t *testing.T) {
	cases := map[string]string{
		"contact alice@example.com":  "contact <email>",
		"from 8.8.8.8 via 10.0.0.12": "from <ip> via 10.0.0.12",
		"jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlc2ln": "jwt <token>",
		"key " + strings.Repeat("Q1z2", 12):                                     "key <token>",
		"sha " + strings.Repeat("ab12", 10):                                     "sha " + strings.Repeat("ab12", 10),
	}
	for input, want := range cases {
		if got := Scrub(input); got != want {
			t.Errorf("Scrub(%q) = %q, want %q", input, got, want)
		}
	}

	if got := Scrub("postgres://user:hunter2@db:5432/x"); strings.Contains(got, "hunter2") {
		t.Errorf("URL credentials survived: %q", got)
	}
	if got := Scrub(strings.Repeat("a ", 2000)); len([]rune(got)) > maxTextLength+1 {
		t.Errorf("not truncated: %d runes", len([]rune(got)))
	}
}

func TestFromEventKeepsOnlyTheAllowlist(t *testing.T) {
	receivedAt := time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC)
	event := parse(t, `{
		"event_id": "e1",
		"timestamp": 4102444800,
		"level": "warn",
		"release": "2026.11.1",
		"exception": {"values": [{"type": "Error", "value": "failed for bob@example.com", "stacktrace": {"frames": [
			{"filename": "/app/dist/main.mjs", "function": "handle", "lineno": 7, "in_app": true, "vars": {"password": "hunter2"}, "context_line": "let password = 'hunter2'"}
		]}}]},
		"tags": {"queue": "email", "user_email": "bob@example.com"},
		"user": {"email": "bob@example.com"},
		"request": {"url": "https://example.com", "headers": {"Authorization": "Bearer hunter2"}},
		"breadcrumbs": [{"message": "hunter2"}],
		"extra": {"secret": "hunter2"},
		"contexts": {"runtime": {"name": "bun", "version": "1.3"}, "device": {"name": "hunter2"}}
	}`)

	occurrence := FromEvent("worker", event, receivedAt)
	if !occurrence.Timestamp.Equal(receivedAt) {
		t.Errorf("a timestamp far in the future should fall back to the receive time, got %v", occurrence.Timestamp)
	}
	if occurrence.Level != "warning" || occurrence.Type != "Error" || occurrence.Value != "failed for <email>" {
		t.Errorf("occurrence = %+v", occurrence)
	}
	if occurrence.Culprit != "handle (main.mjs)" {
		t.Errorf("culprit = %q", occurrence.Culprit)
	}

	encoded, err := json.Marshal(occurrence.Sample)
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"hunter2", "bob@example.com", "user_email", "breadcrumbs", "request", "device"} {
		if strings.Contains(string(encoded), forbidden) {
			t.Errorf("sample contains %q: %s", forbidden, encoded)
		}
	}
	if occurrence.Sample.Tags["component"] != "worker" || occurrence.Sample.Tags["queue"] != "email" {
		t.Errorf("tags = %v", occurrence.Sample.Tags)
	}
}

func TestFromEventKeepsFailureDetailsAndLog(t *testing.T) {
	lines := make([]string, 0, 60)
	for index := 0; index < 60; index++ {
		lines = append(lines, `"line `+itoa(index)+`"`)
	}
	event := parse(t, `{
		"fingerprint": ["integration-deployment-failed", "github", "build_failed"],
		"exception": {"values": [{"type": "IntegrationDeploymentFailed", "value": "GitHub 1.2.0 failed to deploy"}]},
		"tags": {"integration": "github", "error_code": "build_failed", "provider": "kubernetes", "step": "build", "tenant": "acme"},
		"contexts": {
			"details": {
				"Integration Version": "1.2.0",
				"duration_ms": 5400,
				"staged": true,
				"error_message": "npm login as bob@example.com failed",
				"nested": {"secret": "hunter2"},
				"list": ["hunter2"],
				"empty": "  "
			},
			"log": {"lines": [`+strings.Join(lines, ",")+`, 7, "  ", "token ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]}
		}
	}`)

	sample := FromEvent("integration-controller", event, time.Now()).Sample
	for key, want := range map[string]string{"integration": "github", "error_code": "build_failed", "provider": "kubernetes", "step": "build"} {
		if sample.Tags[key] != want {
			t.Errorf("tag %s = %q, want %q", key, sample.Tags[key], want)
		}
	}
	if _, found := sample.Tags["tenant"]; found {
		t.Error("tags outside the allowlist are kept")
	}

	details, _ := sample.Contexts["details"].(map[string]string)
	want := map[string]string{
		"integrationversion": "1.2.0",
		"duration_ms":        "5400",
		"staged":             "true",
		"error_message":      "npm login as <email> failed",
	}
	if len(details) != len(want) {
		t.Errorf("details = %v", details)
	}
	for key, value := range want {
		if details[key] != value {
			t.Errorf("details[%s] = %q, want %q", key, details[key], value)
		}
	}

	log, _ := sample.Contexts["log"].(map[string][]string)
	if len(log["lines"]) != maxLogLines {
		t.Fatalf("log keeps %d lines, want %d", len(log["lines"]), maxLogLines)
	}
	if first := log["lines"][0]; first != "line 11" {
		t.Errorf("log should keep the last lines, starts with %q", first)
	}
	if last := log["lines"][maxLogLines-1]; strings.Contains(last, "ghp_") {
		t.Errorf("log line not scrubbed: %q", last)
	}

	encoded, _ := json.Marshal(sample)
	if strings.Contains(string(encoded), "hunter2") {
		t.Errorf("nested details are kept: %s", encoded)
	}
}

func TestUnparseableGroupsPerComponent(t *testing.T) {
	now := time.Now()
	if Unparseable("worker", now).Hash == Unparseable("core-api", now).Hash {
		t.Error("unparseable events of different components share a group")
	}
	if Unparseable("worker", now).Hash != Unparseable("worker", now.Add(time.Hour)).Hash {
		t.Error("unparseable events of one component should share a group")
	}
}
