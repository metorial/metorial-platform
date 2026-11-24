package issue

import (
	"crypto/sha256"
	"encoding/hex"
	"path"
	"regexp"
	"strings"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/sentry"
)

// GroupingVersion is stored with every group. Bump it when the hash inputs change, so old and new
// groups are told apart instead of silently splitting or merging history.
const GroupingVersion = 1

const maxGroupingFrames = 30

var (
	uuidPattern      = regexp.MustCompile(`\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b`)
	prefixedIDRegexp = regexp.MustCompile(`\b[a-z]{2,12}_[A-Za-z0-9]{10,}\b`)
	isoTimePattern   = regexp.MustCompile(`\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b`)
	hexPattern       = regexp.MustCompile(`\b(?:0x)?[0-9a-fA-F]{8,}\b`)
	numberPattern    = regexp.MustCompile(`\b\d+(?:\.\d+)?`)
)

// Normalize replaces the variable parts of an error message, so the same error with different ids,
// times or numbers lands in one group.
func Normalize(value string) string {
	value = Scrub(value)
	value = uuidPattern.ReplaceAllString(value, "<uuid>")
	value = isoTimePattern.ReplaceAllString(value, "<time>")
	value = prefixedIDRegexp.ReplaceAllString(value, "<id>")
	value = hexPattern.ReplaceAllString(value, "<hex>")
	value = numberPattern.ReplaceAllString(value, "<n>")
	return strings.TrimSpace(value)
}

// defaultComponents follows Sentry's order: the stack trace of each exception, else the exception
// type and message, else the log message. Line and column numbers are left out on purpose: on-prem
// services run one bundled file whose line numbers change with every build, while function names
// survive the bundler.
func defaultComponents(event *sentry.Event) []string {
	var parts []string

	for _, exception := range event.Exception {
		frames := groupingFrames(exception.Stacktrace)
		if len(frames) == 0 {
			parts = append(parts, "exception", exception.Type, Normalize(exception.Value))
			continue
		}

		parts = append(parts, "stacktrace", exception.Type)
		for _, frame := range frames {
			parts = append(parts, frameLocation(frame)+" "+functionName(frame))
		}
	}

	if len(parts) > 0 {
		return parts
	}

	message := event.Message.Template()
	if event.LogEntry != nil && event.LogEntry.Template() != "" {
		message = event.LogEntry.Template()
	}
	return []string{"message", Normalize(message)}
}

func groupingFrames(stacktrace *sentry.Stacktrace) []sentry.Frame {
	if stacktrace == nil {
		return nil
	}

	var inApp []sentry.Frame
	for _, frame := range stacktrace.Frames {
		if frame.InApp != nil && *frame.InApp {
			inApp = append(inApp, frame)
		}
	}

	frames := inApp
	if len(frames) == 0 {
		frames = stacktrace.Frames
	}

	var useful []sentry.Frame
	for _, frame := range frames {
		if functionName(frame) != "" || frameLocation(frame) != "" {
			useful = append(useful, frame)
		}
	}

	if len(useful) > maxGroupingFrames {
		useful = useful[len(useful)-maxGroupingFrames:]
	}
	return useful
}

func frameLocation(frame sentry.Frame) string {
	if frame.Module != "" {
		return frame.Module
	}

	file := frame.Filename
	if file == "" {
		file = frame.AbsPath
	}
	file, _, _ = strings.Cut(file, "?")

	if _, afterModules, found := strings.Cut(file, "node_modules/"); found {
		return afterModules
	}
	return path.Base(file)
}

func functionName(frame sentry.Frame) string {
	switch frame.Function {
	case "", "?", "<anonymous>", "Object.<anonymous>":
		return ""
	default:
		return frame.Function
	}
}

// fingerprintComponents expands an SDK-provided fingerprint; `{{ default }}` stands for the
// default grouping, as in Sentry.
func fingerprintComponents(event *sentry.Event) []string {
	var parts []string
	for _, entry := range event.Fingerprint {
		normalized := strings.ReplaceAll(strings.TrimSpace(entry), " ", "")
		if normalized == "{{default}}" {
			parts = append(parts, defaultComponents(event)...)
			continue
		}
		parts = append(parts, "fingerprint", entry)
	}
	return parts
}

func Hash(component string, event *sentry.Event) string {
	parts := fingerprintComponents(event)
	if len(parts) == 0 {
		parts = defaultComponents(event)
	}

	digest := sha256.New()
	digest.Write([]byte(component))
	for _, part := range parts {
		digest.Write([]byte{0})
		digest.Write([]byte(part))
	}
	return hex.EncodeToString(digest.Sum(nil)[:16])
}
