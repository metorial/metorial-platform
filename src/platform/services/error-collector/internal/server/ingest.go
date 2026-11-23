package server

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"compress/zlib"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/issue"
	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/sentry"
)

const (
	retryAfterSeconds  = "60"
	maxComponentLength = 64
	unknownComponent   = "unknown"
)

var (
	errTooLarge            = errors.New("request body too large")
	errUnsupportedEncoding = errors.New("unsupported content encoding")
)

type Sink interface {
	Add(occurrence issue.Occurrence)
}

type IngestOptions struct {
	Sink             Sink
	MaxConcurrent    int
	MaxBodyBytes     int64
	MaxExpandedBytes int64
	Now              func() time.Time
	Logger           *log.Logger
}

// Ingest implements the part of Sentry's ingestion protocol the SDKs need: envelopes and the
// legacy store endpoint. Every item type is accepted so SDKs don't retry; only events are counted.
type Ingest struct {
	options IngestOptions
	slots   chan struct{}
}

func NewIngest(options IngestOptions) *Ingest {
	if options.Now == nil {
		options.Now = time.Now
	}
	if options.Logger == nil {
		options.Logger = log.Default()
	}
	return &Ingest{options: options, slots: make(chan struct{}, options.MaxConcurrent)}
}

func (i *Ingest) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/{project}/envelope/", i.envelope)
	mux.HandleFunc("POST /api/{project}/envelope", i.envelope)
	mux.HandleFunc("POST /api/{project}/store/", i.store)
	mux.HandleFunc("POST /api/{project}/store", i.store)
	mux.HandleFunc("GET /", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	return mux
}

func (i *Ingest) envelope(w http.ResponseWriter, r *http.Request) {
	body, ok := i.read(w, r)
	if !ok {
		return
	}

	envelope, err := sentry.ParseEnvelope(body)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	receivedAt := i.options.Now()
	key := sentry.PublicKey(r, envelope.Header.DSN)
	eventID := envelope.Header.EventID
	for _, item := range envelope.Items {
		if item.Type != "event" {
			continue
		}
		if id := i.ingestEvent(key, item.Payload, receivedAt); eventID == "" {
			eventID = id
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"id": eventID})
}

func (i *Ingest) store(w http.ResponseWriter, r *http.Request) {
	body, ok := i.read(w, r)
	if !ok {
		return
	}

	id := i.ingestEvent(sentry.PublicKey(r, ""), body, i.options.Now())
	writeJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (i *Ingest) ingestEvent(key string, payload []byte, receivedAt time.Time) string {
	event, err := sentry.ParseEvent(payload)
	if err != nil {
		i.options.Sink.Add(issue.Unparseable(componentName(key, ""), receivedAt))
		return ""
	}

	i.options.Sink.Add(issue.FromEvent(componentName(key, event.Tags["component"]), event, receivedAt))
	return event.EventID
}

// read holds a concurrency slot while it reads, so a burst of large bodies can't exhaust memory.
// When none is free the SDK is told to back off, which both Sentry SDKs honor.
func (i *Ingest) read(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
	select {
	case i.slots <- struct{}{}:
		defer func() { <-i.slots }()
	default:
		w.Header().Set("Retry-After", retryAfterSeconds)
		w.Header().Set("X-Sentry-Rate-Limits", retryAfterSeconds+"::organization")
		writeError(w, http.StatusTooManyRequests, "the collector is busy")
		return nil, false
	}

	body, err := readBody(r, i.options.MaxBodyBytes, i.options.MaxExpandedBytes)
	switch {
	case errors.Is(err, errTooLarge):
		writeError(w, http.StatusRequestEntityTooLarge, err.Error())
		return nil, false
	case errors.Is(err, errUnsupportedEncoding):
		writeError(w, http.StatusUnsupportedMediaType, err.Error())
		return nil, false
	case err != nil:
		writeError(w, http.StatusBadRequest, "the request body could not be read")
		return nil, false
	}
	return body, true
}

func readBody(r *http.Request, maxBody, maxExpanded int64) ([]byte, error) {
	compressed, err := io.ReadAll(io.LimitReader(r.Body, maxBody+1))
	if err != nil {
		return nil, err
	}
	if int64(len(compressed)) > maxBody {
		return nil, errTooLarge
	}

	var reader io.Reader
	switch strings.ToLower(strings.TrimSpace(r.Header.Get("Content-Encoding"))) {
	case "", "identity":
		return compressed, nil
	case "gzip", "x-gzip":
		gz, err := gzip.NewReader(bytes.NewReader(compressed))
		if err != nil {
			return nil, err
		}
		reader = gz
	case "deflate":
		// HTTP's deflate is zlib-wrapped, but some clients send a raw deflate stream.
		if zr, err := zlib.NewReader(bytes.NewReader(compressed)); err == nil {
			reader = zr
		} else {
			reader = flate.NewReader(bytes.NewReader(compressed))
		}
	default:
		return nil, errUnsupportedEncoding
	}

	expanded, err := io.ReadAll(io.LimitReader(reader, maxExpanded+1))
	if err != nil {
		return nil, err
	}
	if int64(len(expanded)) > maxExpanded {
		return nil, errTooLarge
	}
	return expanded, nil
}

// componentName identifies the sending component from its DSN key (each component gets its own
// DSN), falling back to the event's component tag.
func componentName(key, tag string) string {
	for _, candidate := range []string{key, tag} {
		var builder strings.Builder
		for _, char := range strings.ToLower(candidate) {
			if builder.Len() >= maxComponentLength {
				break
			}
			if char >= 'a' && char <= 'z' || char >= '0' && char <= '9' || char == '-' || char == '_' || char == '.' {
				builder.WriteRune(char)
			}
		}
		if builder.Len() > 0 {
			return builder.String()
		}
	}
	return unknownComponent
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"detail": message})
}
