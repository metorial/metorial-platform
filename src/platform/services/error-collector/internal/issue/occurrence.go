package issue

import (
	"encoding/json"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/sentry"
)

const (
	maxSampleFrames     = 50
	maxSampleExceptions = 5
	maxFieldLength      = 256
	clockSkewTolerance  = 5 * time.Minute
	maxDetails          = 40
	maxDetailKeyLength  = 64
	maxDetailLength     = 512
	maxLogLines         = 50
	maxLogLineLength    = 500
)

// Tags that describe where an error happened without saying who triggered it.
var allowedTags = map[string]bool{
	"component": true,
	"queue":     true,
	"route":     true,
	"method":    true,
	"status":    true,
	"handler":   true,
	"boot_step": true,
	// Failed builds, deployments and integration calls (@metorial/error-reporting reportFailure).
	"integration": true,
	"error_code":  true,
	"provider":    true,
	"step":        true,
}

var levels = map[string]bool{"fatal": true, "error": true, "warning": true, "info": true, "debug": true}

type Occurrence struct {
	Hash      string
	Component string
	Level     string
	Type      string
	Value     string
	Culprit   string
	Release   string
	Timestamp time.Time
	Sample    *Sample
}

// Sample is a scrubbed event in Sentry's event shape. Request, user, breadcrumbs, extra data,
// local variables and source lines are never stored. Of the contexts, only runtime and os, plus
// the details (flat values) and log (last lines) of failures the services report themselves.
type Sample struct {
	EventID     string            `json:"event_id,omitempty"`
	Timestamp   string            `json:"timestamp"`
	Level       string            `json:"level"`
	Platform    string            `json:"platform,omitempty"`
	Logger      string            `json:"logger,omitempty"`
	Release     string            `json:"release,omitempty"`
	Environment string            `json:"environment,omitempty"`
	Message     string            `json:"message,omitempty"`
	Exception   *SampleExceptions `json:"exception,omitempty"`
	Fingerprint []string          `json:"fingerprint,omitempty"`
	Tags        map[string]string `json:"tags,omitempty"`
	Contexts    map[string]any    `json:"contexts,omitempty"`
	SDK         *sentry.SDK       `json:"sdk,omitempty"`
}

type SampleExceptions struct {
	Values []SampleException `json:"values"`
}

type SampleException struct {
	Type       string            `json:"type,omitempty"`
	Value      string            `json:"value,omitempty"`
	Module     string            `json:"module,omitempty"`
	Mechanism  *sentry.Mechanism `json:"mechanism,omitempty"`
	Stacktrace *SampleStacktrace `json:"stacktrace,omitempty"`
}

type SampleStacktrace struct {
	Frames []SampleFrame `json:"frames"`
}

type SampleFrame struct {
	Filename string `json:"filename,omitempty"`
	Module   string `json:"module,omitempty"`
	Function string `json:"function,omitempty"`
	Lineno   int    `json:"lineno,omitempty"`
	Colno    int    `json:"colno,omitempty"`
	InApp    *bool  `json:"in_app,omitempty"`
}

func FromEvent(component string, event *sentry.Event, receivedAt time.Time) Occurrence {
	timestamp := event.Timestamp.Time
	if timestamp.IsZero() || timestamp.After(receivedAt.Add(clockSkewTolerance)) {
		timestamp = receivedAt
	}

	level := strings.ToLower(event.Level)
	if level == "warn" {
		level = "warning"
	}
	if !levels[level] {
		level = "error"
	}

	occurrence := Occurrence{
		Hash:      Hash(component, event),
		Component: component,
		Level:     level,
		Release:   truncate(event.Release, maxFieldLength),
		Timestamp: timestamp.UTC(),
	}

	if len(event.Exception) > 0 {
		last := event.Exception[len(event.Exception)-1]
		occurrence.Type = truncate(last.Type, maxFieldLength)
		occurrence.Value = Scrub(last.Value)
		occurrence.Culprit = culprit(last.Stacktrace)
	} else {
		occurrence.Value = Scrub(messageText(event))
	}

	occurrence.Sample = sampleFromEvent(component, event, occurrence)
	return occurrence
}

// Unparseable counts a payload that isn't valid event JSON, so a broken SDK still shows up.
func Unparseable(component string, receivedAt time.Time) Occurrence {
	return Occurrence{
		Hash:      Hash(component, &sentry.Event{Fingerprint: []string{"unparseable-event"}}),
		Component: component,
		Level:     "error",
		Type:      "UnparseableEvent",
		Value:     "The collector received an event it could not parse.",
		Timestamp: receivedAt.UTC(),
	}
}

func messageText(event *sentry.Event) string {
	if event.LogEntry != nil && event.LogEntry.Text() != "" {
		return event.LogEntry.Text()
	}
	return event.Message.Text()
}

func culprit(stacktrace *sentry.Stacktrace) string {
	frames := groupingFrames(stacktrace)
	for i := len(frames) - 1; i >= 0; i-- {
		name := functionName(frames[i])
		location := frameLocation(frames[i])
		if name == "" && location == "" {
			continue
		}
		if name == "" {
			return truncate(location, maxFieldLength)
		}
		return truncate(name+" ("+location+")", maxFieldLength)
	}
	return ""
}

func sampleFromEvent(component string, event *sentry.Event, occurrence Occurrence) *Sample {
	sample := &Sample{
		EventID:     truncate(event.EventID, 64),
		Timestamp:   occurrence.Timestamp.Format(time.RFC3339Nano),
		Level:       occurrence.Level,
		Platform:    truncate(event.Platform, 32),
		Logger:      truncate(event.Logger, maxFieldLength),
		Release:     occurrence.Release,
		Environment: truncate(event.Environment, maxFieldLength),
		Message:     Scrub(messageText(event)),
		SDK:         event.SDK,
		Tags:        map[string]string{"component": component},
	}

	for key, value := range event.Tags {
		if allowedTags[key] && key != "component" {
			sample.Tags[key] = truncate(Scrub(value), maxFieldLength)
		}
	}

	for _, entry := range event.Fingerprint {
		sample.Fingerprint = append(sample.Fingerprint, truncate(Scrub(entry), maxFieldLength))
	}

	for _, name := range []string{"runtime", "os"} {
		context := event.Context(name)
		if context.Name == "" && context.Version == "" {
			continue
		}
		if sample.Contexts == nil {
			sample.Contexts = map[string]any{}
		}
		sample.Contexts[name] = map[string]string{
			"name":    truncate(context.Name, maxFieldLength),
			"version": truncate(context.Version, maxFieldLength),
		}
	}

	if details := sampleDetails(event.Contexts["details"]); len(details) > 0 {
		if sample.Contexts == nil {
			sample.Contexts = map[string]any{}
		}
		sample.Contexts["details"] = details
	}
	if lines := sampleLog(event.Contexts["log"]); len(lines) > 0 {
		if sample.Contexts == nil {
			sample.Contexts = map[string]any{}
		}
		sample.Contexts["log"] = map[string][]string{"lines": lines}
	}

	exceptions := event.Exception
	if len(exceptions) > maxSampleExceptions {
		exceptions = exceptions[len(exceptions)-maxSampleExceptions:]
	}
	if len(exceptions) > 0 {
		sample.Exception = &SampleExceptions{}
	}
	for _, exception := range exceptions {
		sample.Exception.Values = append(sample.Exception.Values, sampleException(exception))
	}

	return sample
}

func sampleException(exception sentry.Exception) SampleException {
	result := SampleException{
		Type:      truncate(exception.Type, maxFieldLength),
		Value:     Scrub(exception.Value),
		Module:    truncate(exception.Module, maxFieldLength),
		Mechanism: exception.Mechanism,
	}
	if result.Mechanism != nil {
		result.Mechanism = &sentry.Mechanism{
			Type:    truncate(result.Mechanism.Type, 64),
			Handled: result.Mechanism.Handled,
		}
	}

	if exception.Stacktrace == nil || len(exception.Stacktrace.Frames) == 0 {
		return result
	}

	frames := exception.Stacktrace.Frames
	if len(frames) > maxSampleFrames {
		frames = frames[len(frames)-maxSampleFrames:]
	}

	result.Stacktrace = &SampleStacktrace{}
	for _, frame := range frames {
		filename := frame.Filename
		if filename == "" {
			filename = frame.AbsPath
		}
		filename, _, _ = strings.Cut(filename, "?")

		result.Stacktrace.Frames = append(result.Stacktrace.Frames, SampleFrame{
			Filename: truncate(filename, maxFieldLength),
			Module:   truncate(frame.Module, maxFieldLength),
			Function: truncate(frame.Function, maxFieldLength),
			Lineno:   frame.Lineno,
			Colno:    frame.Colno,
			InApp:    frame.InApp,
		})
	}
	return result
}

// sampleDetails keeps the scalar values of the details context, scrubbed. Nested values are
// dropped, so the context can't carry request bodies or other structured data.
func sampleDetails(raw json.RawMessage) map[string]string {
	var values map[string]any
	if len(raw) == 0 || json.Unmarshal(raw, &values) != nil {
		return nil
	}

	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	result := map[string]string{}
	for _, key := range keys {
		if len(result) >= maxDetails {
			break
		}
		name := detailKey(key)
		if name == "" {
			continue
		}

		var text string
		switch value := values[key].(type) {
		case string:
			text = value
		case float64:
			text = strconv.FormatFloat(value, 'f', -1, 64)
		case bool:
			text = strconv.FormatBool(value)
		default:
			continue
		}
		if text = truncate(Scrub(strings.TrimSpace(text)), maxDetailLength); text != "" {
			result[name] = text
		}
	}
	return result
}

func detailKey(key string) string {
	var builder strings.Builder
	for _, char := range strings.ToLower(key) {
		if builder.Len() >= maxDetailKeyLength {
			break
		}
		if char >= 'a' && char <= 'z' || char >= '0' && char <= '9' || char == '_' || char == '.' || char == '-' {
			builder.WriteRune(char)
		}
	}
	return builder.String()
}

// sampleLog keeps the last lines of the log context, each scrubbed like a message.
func sampleLog(raw json.RawMessage) []string {
	var log struct {
		Lines []any `json:"lines"`
	}
	if len(raw) == 0 || json.Unmarshal(raw, &log) != nil {
		return nil
	}

	var lines []string
	for _, entry := range log.Lines {
		line, ok := entry.(string)
		if !ok || strings.TrimSpace(line) == "" {
			continue
		}
		lines = append(lines, truncate(Scrub(strings.TrimRight(line, " \t\r\n")), maxLogLineLength))
	}
	if len(lines) > maxLogLines {
		lines = lines[len(lines)-maxLogLines:]
	}
	return lines
}
