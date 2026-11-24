package sentry

import (
	"errors"
	"net/http/httptest"
	"testing"
	"time"
)

func TestParseEnvelopeWithAndWithoutLength(t *testing.T) {
	body := []byte(`{"event_id":"abc","dsn":"http://worker@error-collector:8095/1"}
{"type":"event","length":13}
{"message":1}
{"type":"session"}
{"started":"x"}
{"type":"attachment","length":3}
a
b

`)

	envelope, err := ParseEnvelope(body)
	if err != nil {
		t.Fatal(err)
	}

	if envelope.Header.EventID != "abc" || envelope.Header.DSN == "" {
		t.Fatalf("header = %+v", envelope.Header)
	}
	if len(envelope.Items) != 3 {
		t.Fatalf("items = %d, want 3", len(envelope.Items))
	}
	if envelope.Items[0].Type != "event" || string(envelope.Items[0].Payload) != `{"message":1}` {
		t.Fatalf("event item = %q %q", envelope.Items[0].Type, envelope.Items[0].Payload)
	}
	if string(envelope.Items[1].Payload) != `{"started":"x"}` {
		t.Fatalf("session payload = %q", envelope.Items[1].Payload)
	}
	if string(envelope.Items[2].Payload) != "a\nb" {
		t.Fatalf("attachment payload = %q", envelope.Items[2].Payload)
	}
}

func TestParseEnvelopeRejectsMalformedInput(t *testing.T) {
	cases := []string{
		"not json",
		"{}\nnot json\n{}",
		"{}\n{\"type\":\"event\",\"length\":100}\n{}",
	}

	for _, body := range cases {
		if _, err := ParseEnvelope([]byte(body)); !errors.Is(err, ErrMalformedEnvelope) {
			t.Errorf("ParseEnvelope(%q) error = %v, want ErrMalformedEnvelope", body, err)
		}
	}
}

func TestPublicKeySources(t *testing.T) {
	request := httptest.NewRequest("POST", "/api/1/envelope/", nil)
	request.Header.Set("X-Sentry-Auth", "Sentry sentry_version=7, sentry_key=core-api, sentry_client=sentry.javascript/11")
	if key := PublicKey(request, ""); key != "core-api" {
		t.Errorf("X-Sentry-Auth key = %q", key)
	}

	request = httptest.NewRequest("POST", "/api/1/envelope/?sentry_key=worker&sentry_version=7", nil)
	if key := PublicKey(request, ""); key != "worker" {
		t.Errorf("query key = %q", key)
	}

	request = httptest.NewRequest("POST", "/api/1/envelope/", nil)
	if key := PublicKey(request, "http://search@error-collector:8095/1"); key != "search" {
		t.Errorf("envelope DSN key = %q", key)
	}
	if key := PublicKey(request, ""); key != "" {
		t.Errorf("missing key = %q", key)
	}
}

func TestParseEventIsLenient(t *testing.T) {
	event, err := ParseEvent([]byte(`{
		"event_id": "e1",
		"timestamp": 1700000000.5,
		"level": "error",
		"message": {"message": "Failed %s", "formatted": "Failed job"},
		"exception": [{"type": "Error", "value": "boom", "stacktrace": {"frames": [{"function": "run", "in_app": true}]}}],
		"tags": [["component", "worker"], ["queue", "email"]],
		"contexts": {"runtime": {"name": "bun", "version": "1.3"}, "trace": {"sampled": true}},
		"request": {"url": "https://example.com/?token=secret"},
		"extra": {"anything": [1, 2, 3]}
	}`))
	if err != nil {
		t.Fatal(err)
	}

	if event.Message.Template() != "Failed %s" || event.Message.Text() != "Failed job" {
		t.Errorf("message = %q / %q", event.Message.Template(), event.Message.Text())
	}
	if len(event.Exception) != 1 || event.Exception[0].Type != "Error" {
		t.Errorf("exception = %+v", event.Exception)
	}
	if event.Tags["component"] != "worker" || event.Tags["queue"] != "email" {
		t.Errorf("tags = %v", event.Tags)
	}
	if runtime := event.Context("runtime"); runtime.Name != "bun" || runtime.Version != "1.3" {
		t.Errorf("runtime = %+v", runtime)
	}
	if want := time.Unix(1700000000, 500000000).UTC(); !event.Timestamp.Time.Equal(want) {
		t.Errorf("timestamp = %v, want %v", event.Timestamp.Time, want)
	}

	event, err = ParseEvent([]byte(`{"message":"plain","exception":{"values":[{"type":"A"},{"type":"B"}]},"timestamp":"2024-05-01T10:00:00Z","tags":{"status":500}}`))
	if err != nil {
		t.Fatal(err)
	}
	if event.Message.Text() != "plain" || len(event.Exception) != 2 || event.Tags["status"] != "500" {
		t.Errorf("event = %+v", event)
	}
}
