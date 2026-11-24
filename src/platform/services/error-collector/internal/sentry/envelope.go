package sentry

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

var ErrMalformedEnvelope = errors.New("malformed envelope")

type EnvelopeHeader struct {
	EventID string `json:"event_id"`
	DSN     string `json:"dsn"`
}

type Item struct {
	Type    string
	Payload []byte
}

type Envelope struct {
	Header EnvelopeHeader
	Items  []Item
}

type itemHeader struct {
	Type   string `json:"type"`
	Length *int   `json:"length"`
}

// ParseEnvelope reads the newline-delimited envelope format: one header line, then for each item a
// header line and its payload. An item header without a length runs to the next newline.
func ParseEnvelope(body []byte) (*Envelope, error) {
	headerLine, rest, _ := bytes.Cut(body, []byte("\n"))

	envelope := &Envelope{}
	if err := json.Unmarshal(headerLine, &envelope.Header); err != nil {
		return nil, fmt.Errorf("%w: header: %v", ErrMalformedEnvelope, err)
	}

	for len(rest) > 0 {
		var line []byte
		line, rest, _ = bytes.Cut(rest, []byte("\n"))
		if len(bytes.TrimSpace(line)) == 0 {
			continue
		}

		var header itemHeader
		if err := json.Unmarshal(line, &header); err != nil {
			return nil, fmt.Errorf("%w: item header: %v", ErrMalformedEnvelope, err)
		}

		var payload []byte
		if header.Length != nil {
			length := *header.Length
			if length < 0 || length > len(rest) {
				return nil, fmt.Errorf("%w: item length %d exceeds the body", ErrMalformedEnvelope, length)
			}
			payload, rest = rest[:length], rest[length:]
			rest = bytes.TrimPrefix(rest, []byte("\n"))
		} else {
			payload, rest, _ = bytes.Cut(rest, []byte("\n"))
		}

		envelope.Items = append(envelope.Items, Item{Type: header.Type, Payload: payload})
	}

	return envelope, nil
}

// PublicKey finds the DSN key the way Relay does: the X-Sentry-Auth header, an Authorization
// header in the same format, the sentry_key query parameter, then the DSN in the envelope header.
func PublicKey(r *http.Request, envelopeDSN string) string {
	for _, header := range []string{r.Header.Get("X-Sentry-Auth"), r.Header.Get("Authorization")} {
		if key := keyFromAuthHeader(header); key != "" {
			return key
		}
	}

	if key := r.URL.Query().Get("sentry_key"); key != "" {
		return key
	}

	if envelopeDSN != "" {
		if parsed, err := url.Parse(envelopeDSN); err == nil && parsed.User != nil {
			return parsed.User.Username()
		}
	}

	return ""
}

func keyFromAuthHeader(header string) string {
	value, ok := strings.CutPrefix(strings.TrimSpace(header), "Sentry ")
	if !ok {
		return ""
	}

	for _, part := range strings.Split(value, ",") {
		key, val, found := strings.Cut(strings.TrimSpace(part), "=")
		if found && key == "sentry_key" {
			return strings.TrimSpace(val)
		}
	}

	return ""
}
