package supervisor

import (
	"bufio"
	"encoding/json"
	"io"
	"sync"
	"time"
)

const (
	truncationMarker = "[metorial] log output truncated: the 1 MB per-invocation limit was reached"
	maxPipeLineBytes = 64 << 10
)

type LogLine struct {
	Time   time.Time
	Stream string
	Line   string
}

type logBuffer struct {
	limit     int
	size      int
	lines     []LogLine
	truncated bool
}

func (b *logBuffer) add(line LogLine) {
	if b.truncated {
		return
	}
	if b.size+len(line.Line) > b.limit {
		b.truncated = true
		b.lines = append(b.lines, LogLine{Time: line.Time, Stream: "stderr", Line: truncationMarker})
		return
	}
	b.size += len(line.Line)
	b.lines = append(b.lines, line)
}

// stdoutLog writes one JSON object per line to the pod's stdout, the stream the cluster's
// log stack collects. Supervisor diagnostics (slog) share the writer so lines never interleave.
type stdoutLog struct {
	mu sync.Mutex
	w  io.Writer
}

func (l *stdoutLog) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.w.Write(p)
}

type functionLogRecord struct {
	Time         string `json:"time"`
	Source       string `json:"source"`
	RequestID    string `json:"requestId,omitempty"`
	InvocationID string `json:"invocationId,omitempty"`
	Stream       string `json:"stream"`
	Line         string `json:"line"`
}

func (l *stdoutLog) function(requestID, invocationID string, line LogLine) {
	out, err := json.Marshal(functionLogRecord{
		Time:         line.Time.UTC().Format(time.RFC3339Nano),
		Source:       "function",
		RequestID:    requestID,
		InvocationID: invocationID,
		Stream:       line.Stream,
		Line:         line.Line,
	})
	if err != nil {
		return
	}
	_, _ = l.Write(append(out, '\n'))
}

// pipeLines forwards a worker stdio pipe as instance logs (no request context).
func (l *stdoutLog) pipeLines(stream string, r io.Reader) {
	reader := bufio.NewReaderSize(r, maxPipeLineBytes)
	for {
		chunk, isPrefix, err := reader.ReadLine()
		if len(chunk) > 0 || (err == nil && !isPrefix) {
			l.function("", "", LogLine{Time: time.Now(), Stream: stream, Line: string(chunk)})
		}
		if err != nil {
			return
		}
	}
}
