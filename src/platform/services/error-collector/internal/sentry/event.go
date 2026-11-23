package sentry

import (
	"bytes"
	"encoding/json"
	"math"
	"strings"
	"time"
)

// Event is the subset of the Sentry event payload the collector reads. Fields that SDKs send in
// more than one shape (message, exception, tags, timestamp) have their own decoders.
type Event struct {
	EventID     string                     `json:"event_id"`
	Timestamp   Timestamp                  `json:"timestamp"`
	Level       string                     `json:"level"`
	Platform    string                     `json:"platform"`
	Logger      string                     `json:"logger"`
	Release     string                     `json:"release"`
	Environment string                     `json:"environment"`
	Transaction string                     `json:"transaction"`
	Message     Message                    `json:"message"`
	LogEntry    *Message                   `json:"logentry"`
	Exception   Exceptions                 `json:"exception"`
	Fingerprint []string                   `json:"fingerprint"`
	Tags        Tags                       `json:"tags"`
	Contexts    map[string]json.RawMessage `json:"contexts"`
	SDK         *SDK                       `json:"sdk"`
}

type SDK struct {
	Name    string `json:"name,omitempty"`
	Version string `json:"version,omitempty"`
}

type Context struct {
	Name    string `json:"name,omitempty"`
	Version string `json:"version,omitempty"`
}

// Context reads the name and version of one context, ignoring every other field and any value
// that isn't a string.
func (e *Event) Context(name string) Context {
	var raw map[string]any
	if err := json.Unmarshal(e.Contexts[name], &raw); err != nil {
		return Context{}
	}

	result := Context{}
	result.Name, _ = raw["name"].(string)
	result.Version, _ = raw["version"].(string)
	return result
}

type Exception struct {
	Type       string      `json:"type"`
	Value      string      `json:"value"`
	Module     string      `json:"module"`
	Mechanism  *Mechanism  `json:"mechanism"`
	Stacktrace *Stacktrace `json:"stacktrace"`
}

type Mechanism struct {
	Type    string `json:"type"`
	Handled *bool  `json:"handled"`
}

type Stacktrace struct {
	Frames []Frame `json:"frames"`
}

type Frame struct {
	Filename string `json:"filename"`
	AbsPath  string `json:"abs_path"`
	Module   string `json:"module"`
	Function string `json:"function"`
	Lineno   int    `json:"lineno"`
	Colno    int    `json:"colno"`
	InApp    *bool  `json:"in_app"`
}

// Message accepts a plain string or the {message, formatted, params} object.
type Message struct {
	Message   string `json:"message"`
	Formatted string `json:"formatted"`
}

func (m *Message) UnmarshalJSON(data []byte) error {
	data = bytes.TrimSpace(data)
	if len(data) == 0 || data[0] == 'n' {
		return nil
	}

	if data[0] == '"' {
		return json.Unmarshal(data, &m.Formatted)
	}

	type plain Message
	var decoded plain
	if err := json.Unmarshal(data, &decoded); err != nil {
		return nil
	}

	*m = Message(decoded)
	return nil
}

// Template is the unformatted message when the SDK sent one (stable across parameters).
func (m Message) Template() string {
	if m.Message != "" {
		return m.Message
	}
	return m.Formatted
}

func (m Message) Text() string {
	if m.Formatted != "" {
		return m.Formatted
	}
	return m.Message
}

// Exceptions accepts {"values": [...]}, a bare list, or a single exception object.
type Exceptions []Exception

func (e *Exceptions) UnmarshalJSON(data []byte) error {
	data = bytes.TrimSpace(data)
	if len(data) == 0 || data[0] == 'n' {
		return nil
	}

	if data[0] == '[' {
		var list []Exception
		if err := json.Unmarshal(data, &list); err != nil {
			return err
		}
		*e = list
		return nil
	}

	var wrapped struct {
		Values *[]Exception `json:"values"`
	}
	if err := json.Unmarshal(data, &wrapped); err != nil {
		return err
	}
	if wrapped.Values != nil {
		*e = *wrapped.Values
		return nil
	}

	var single Exception
	if err := json.Unmarshal(data, &single); err != nil {
		return err
	}
	if single.Type != "" || single.Value != "" {
		*e = []Exception{single}
	}
	return nil
}

// Tags accepts an object or a list of [key, value] pairs.
type Tags map[string]string

func (t *Tags) UnmarshalJSON(data []byte) error {
	data = bytes.TrimSpace(data)
	if len(data) == 0 || data[0] == 'n' {
		return nil
	}

	result := Tags{}
	if data[0] == '[' {
		var pairs [][]any
		if err := json.Unmarshal(data, &pairs); err != nil {
			return nil
		}
		for _, pair := range pairs {
			if len(pair) != 2 {
				continue
			}
			key, keyOk := pair[0].(string)
			if keyOk {
				result[key] = stringify(pair[1])
			}
		}
		*t = result
		return nil
	}

	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil
	}
	for key, value := range raw {
		result[key] = stringify(value)
	}
	*t = result
	return nil
}

func stringify(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case nil:
		return ""
	default:
		encoded, _ := json.Marshal(v)
		return string(encoded)
	}
}

// Timestamp accepts seconds since the epoch (fractional) or an RFC 3339 string.
type Timestamp struct {
	time.Time
}

func (t *Timestamp) UnmarshalJSON(data []byte) error {
	data = bytes.TrimSpace(data)
	if len(data) == 0 || data[0] == 'n' {
		return nil
	}

	if data[0] == '"' {
		var raw string
		if err := json.Unmarshal(data, &raw); err != nil {
			return nil
		}
		for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.999999999"} {
			if parsed, err := time.Parse(layout, strings.TrimSpace(raw)); err == nil {
				t.Time = parsed.UTC()
				return nil
			}
		}
		return nil
	}

	var seconds float64
	if err := json.Unmarshal(data, &seconds); err != nil || math.IsNaN(seconds) || math.IsInf(seconds, 0) {
		return nil
	}
	whole, fraction := math.Modf(seconds)
	t.Time = time.Unix(int64(whole), int64(fraction*1e9)).UTC()
	return nil
}

func ParseEvent(payload []byte) (*Event, error) {
	var event Event
	if err := json.Unmarshal(payload, &event); err != nil {
		return nil, err
	}
	return &event, nil
}
