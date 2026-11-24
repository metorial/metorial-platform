package server

import (
	"bytes"
	"compress/gzip"
	"compress/zlib"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/issue"
)

type recordingSink struct {
	mu          sync.Mutex
	occurrences []issue.Occurrence
}

func (s *recordingSink) Add(occurrence issue.Occurrence) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.occurrences = append(s.occurrences, occurrence)
}

func newIngest(sink *recordingSink) *Ingest {
	return NewIngest(IngestOptions{
		Sink:             sink,
		MaxConcurrent:    4,
		MaxBodyBytes:     1 << 16,
		MaxExpandedBytes: 1 << 18,
		Now:              func() time.Time { return time.Date(2026, 11, 20, 12, 0, 0, 0, time.UTC) },
	})
}

var envelopeBody = `{"event_id":"9ec79c33ec9942ab8353589fcb2e04dc","dsn":"http://ignored@error-collector:8095/1"}
{"type":"event"}
{"event_id":"9ec79c33ec9942ab8353589fcb2e04dc","exception":{"values":[{"type":"Error","value":"boom"}]}}
{"type":"transaction"}
{"type":"transaction","spans":[]}
{"type":"client_report"}
{"discarded_events":[]}
`

func post(t *testing.T, handler http.Handler, path string, body []byte, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

func TestEnvelopeCountsOnlyEvents(t *testing.T) {
	sink := &recordingSink{}
	response := post(t, newIngest(sink).Handler(), "/api/1/envelope/", []byte(envelopeBody), map[string]string{
		"X-Sentry-Auth": "Sentry sentry_key=Core-API, sentry_version=7",
	})

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", response.Code, response.Body)
	}
	var body map[string]string
	_ = json.Unmarshal(response.Body.Bytes(), &body)
	if body["id"] != "9ec79c33ec9942ab8353589fcb2e04dc" {
		t.Errorf("id = %q", body["id"])
	}
	if len(sink.occurrences) != 1 || sink.occurrences[0].Component != "core-api" || sink.occurrences[0].Type != "Error" {
		t.Fatalf("occurrences = %+v", sink.occurrences)
	}
}

func TestCompressedBodies(t *testing.T) {
	var gz bytes.Buffer
	writer := gzip.NewWriter(&gz)
	_, _ = writer.Write([]byte(envelopeBody))
	_ = writer.Close()

	var deflated bytes.Buffer
	zw := zlib.NewWriter(&deflated)
	_, _ = zw.Write([]byte(envelopeBody))
	_ = zw.Close()

	sink := &recordingSink{}
	handler := newIngest(sink).Handler()
	for encoding, body := range map[string][]byte{"gzip": gz.Bytes(), "deflate": deflated.Bytes()} {
		response := post(t, handler, "/api/1/envelope/?sentry_key=worker", body, map[string]string{"Content-Encoding": encoding})
		if response.Code != http.StatusOK {
			t.Errorf("%s: status = %d: %s", encoding, response.Code, response.Body)
		}
	}
	if len(sink.occurrences) != 2 {
		t.Errorf("occurrences = %d, want 2", len(sink.occurrences))
	}

	response := post(t, handler, "/api/1/envelope/", []byte(envelopeBody), map[string]string{"Content-Encoding": "br"})
	if response.Code != http.StatusUnsupportedMediaType {
		t.Errorf("brotli status = %d", response.Code)
	}
}

func TestBodyLimits(t *testing.T) {
	handler := newIngest(&recordingSink{}).Handler()

	response := post(t, handler, "/api/1/envelope/", bytes.Repeat([]byte("x"), 1<<17), nil)
	if response.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("large body status = %d", response.Code)
	}

	var bomb bytes.Buffer
	writer := gzip.NewWriter(&bomb)
	_, _ = writer.Write(bytes.Repeat([]byte("{}"), 1<<18))
	_ = writer.Close()
	response = post(t, handler, "/api/1/envelope/", bomb.Bytes(), map[string]string{"Content-Encoding": "gzip"})
	if response.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("expanded body status = %d", response.Code)
	}
}

func TestBusyCollectorAsksToBackOff(t *testing.T) {
	ingest := newIngest(&recordingSink{})
	for range cap(ingest.slots) {
		ingest.slots <- struct{}{}
	}

	response := post(t, ingest.Handler(), "/api/1/envelope/", []byte(envelopeBody), nil)
	if response.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d", response.Code)
	}
	if response.Header().Get("Retry-After") == "" || !strings.HasPrefix(response.Header().Get("X-Sentry-Rate-Limits"), "60:") {
		t.Errorf("headers = %v", response.Header())
	}
}

func TestStoreEndpointAndBrokenEvents(t *testing.T) {
	sink := &recordingSink{}
	handler := newIngest(sink).Handler()

	response := post(t, handler, "/api/1/store/", []byte(`{"event_id":"e1","message":"hello","tags":{"component":"search"}}`), nil)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d", response.Code)
	}

	response = post(t, handler, "/api/1/envelope/?sentry_key=worker", []byte("{}\n{\"type\":\"event\"}\nnot json\n"), nil)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d", response.Code)
	}

	if response := post(t, handler, "/api/1/envelope/", []byte("garbage"), nil); response.Code != http.StatusBadRequest {
		t.Errorf("malformed envelope status = %d", response.Code)
	}

	if len(sink.occurrences) != 2 {
		t.Fatalf("occurrences = %+v", sink.occurrences)
	}
	if sink.occurrences[0].Component != "search" {
		t.Errorf("tag component = %q", sink.occurrences[0].Component)
	}
	if sink.occurrences[1].Type != "UnparseableEvent" || sink.occurrences[1].Component != "worker" {
		t.Errorf("unparseable = %+v", sink.occurrences[1])
	}
}

func TestComponentName(t *testing.T) {
	cases := map[[2]string]string{
		{"Core-API", "x"}:              "core-api",
		{"", "worker"}:                 "worker",
		{"", ""}:                       unknownComponent,
		{"../../etc", ""}:              "....etc",
		{strings.Repeat("a", 100), ""}: strings.Repeat("a", maxComponentLength),
	}
	for input, want := range cases {
		if got := componentName(input[0], input[1]); got != want {
			t.Errorf("componentName(%q, %q) = %q, want %q", input[0], input[1], got, want)
		}
	}
}
