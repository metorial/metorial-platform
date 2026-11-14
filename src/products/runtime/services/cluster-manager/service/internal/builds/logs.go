package builds

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"
)

const maxLogLineBytes = 256 << 10

type LogLine struct {
	TS   time.Time
	Line string
}

// Cursor is the timestamp of the last returned line plus how many lines with exactly that
// timestamp were already returned. The pod-log API only filters by whole seconds, so lines
// sharing a timestamp are told apart by position.
type Cursor struct {
	TS   time.Time
	Skip int
}

func (c Cursor) String() string {
	if c.TS.IsZero() {
		return ""
	}
	return c.TS.UTC().Format(time.RFC3339Nano) + "|" + strconv.Itoa(c.Skip)
}

func ParseCursor(s string) (Cursor, error) {
	if s == "" {
		return Cursor{}, nil
	}
	ts, skip, ok := strings.Cut(s, "|")
	if !ok {
		return Cursor{}, fmt.Errorf("invalid cursor")
	}
	t, err := time.Parse(time.RFC3339Nano, ts)
	if err != nil {
		return Cursor{}, fmt.Errorf("invalid cursor timestamp: %w", err)
	}
	n, err := strconv.Atoi(skip)
	if err != nil || n < 0 {
		return Cursor{}, fmt.Errorf("invalid cursor offset")
	}
	return Cursor{TS: t, Skip: n}, nil
}

// SinceTime is the sinceTime to request from the pod-log API for this cursor.
func (c Cursor) SinceTime() *time.Time {
	if c.TS.IsZero() {
		return nil
	}
	t := c.TS.Truncate(time.Second)
	return &t
}

// ReadLines reads timestamped pod log lines ("<RFC3339Nano> <text>") after the cursor, up to
// limit lines, and returns them with the cursor to continue from.
func ReadLines(r io.Reader, cursor Cursor, limit int) ([]LogLine, Cursor, error) {
	reader := bufio.NewReaderSize(r, 64<<10)
	var lines []LogLine
	var lastTS time.Time
	skipped := 0

	for len(lines) < limit {
		raw, err := readLine(reader)
		if raw == "" && err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return lines, next(cursor, lines), err
		}

		ts, text := splitTimestamp(raw, lastTS)
		lastTS = ts

		if !cursor.TS.IsZero() {
			if ts.Before(cursor.TS) {
				continue
			}
			if ts.Equal(cursor.TS) && skipped < cursor.Skip {
				skipped++
				continue
			}
		}
		lines = append(lines, LogLine{TS: ts, Line: text})
	}

	return lines, next(cursor, lines), nil
}

func next(cursor Cursor, lines []LogLine) Cursor {
	if len(lines) == 0 {
		return cursor
	}
	last := lines[len(lines)-1].TS
	n := 0
	for i := len(lines) - 1; i >= 0 && lines[i].TS.Equal(last); i-- {
		n++
	}
	if last.Equal(cursor.TS) {
		n += cursor.Skip
	}
	return Cursor{TS: last, Skip: n}
}

func splitTimestamp(raw string, fallback time.Time) (time.Time, string) {
	prefix, rest, ok := strings.Cut(raw, " ")
	if ok {
		if ts, err := time.Parse(time.RFC3339Nano, prefix); err == nil {
			return ts, rest
		}
	}
	return fallback, raw
}

func readLine(r *bufio.Reader) (string, error) {
	var b strings.Builder
	for {
		chunk, isPrefix, err := r.ReadLine()
		if b.Len() < maxLogLineBytes {
			b.Write(chunk[:min(len(chunk), maxLogLineBytes-b.Len())])
		}
		if err != nil {
			return b.String(), err
		}
		if !isPrefix {
			return b.String(), nil
		}
	}
}
