package builds

import (
	"strings"
	"testing"
	"time"
)

const podLog = `2026-01-01T00:00:00.100000000Z first
2026-01-01T00:00:01.000000000Z same-a
2026-01-01T00:00:01.000000000Z same-b
2026-01-01T00:00:01.000000000Z same-c
2026-01-01T00:00:02.500000000Z last
`

func TestCursorRoundTrip(t *testing.T) {
	c := Cursor{TS: time.Date(2026, 1, 1, 0, 0, 1, 500, time.UTC), Skip: 2}
	parsed, err := ParseCursor(c.String())
	if err != nil {
		t.Fatal(err)
	}
	if !parsed.TS.Equal(c.TS) || parsed.Skip != 2 {
		t.Fatalf("round trip changed the cursor: %+v", parsed)
	}
	if since := parsed.SinceTime(); !since.Equal(time.Date(2026, 1, 1, 0, 0, 1, 0, time.UTC)) {
		t.Fatalf("sinceTime must truncate to seconds, got %v", since)
	}

	empty, err := ParseCursor("")
	if err != nil || !empty.TS.IsZero() || empty.SinceTime() != nil || empty.String() != "" {
		t.Fatalf("empty cursor mishandled: %+v %v", empty, err)
	}
}

func TestParseCursorRejectsGarbage(t *testing.T) {
	for _, s := range []string{"nope", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z|x", "2026-01-01T00:00:00Z|-1", "yesterday|1"} {
		if _, err := ParseCursor(s); err == nil {
			t.Errorf("%q should not parse", s)
		}
	}
}

func readAll(t *testing.T, limit int) []string {
	t.Helper()
	var out []string
	cursor := Cursor{}
	for range 20 {
		lines, next, err := ReadLines(strings.NewReader(podLog), cursor, limit)
		if err != nil {
			t.Fatal(err)
		}
		if len(lines) == 0 {
			return out
		}
		for _, l := range lines {
			out = append(out, l.Line)
		}
		if parsed, err := ParseCursor(next.String()); err != nil {
			t.Fatal(err)
		} else {
			cursor = parsed
		}
	}
	t.Fatal("pagination did not terminate")
	return nil
}

func TestReadLinesPaginatesAcrossEqualTimestamps(t *testing.T) {
	want := "first,same-a,same-b,same-c,last"
	for _, limit := range []int{1, 2, 3, 10} {
		if got := strings.Join(readAll(t, limit), ","); got != want {
			t.Errorf("limit %d: got %s", limit, got)
		}
	}
}

func TestReadLinesKeepsUntimestampedLines(t *testing.T) {
	lines, _, err := ReadLines(strings.NewReader("2026-01-01T00:00:00Z a\nno timestamp here\n"), Cursor{}, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 2 || lines[1].Line != "no timestamp here" || !lines[1].TS.Equal(lines[0].TS) {
		t.Fatalf("unexpected lines %+v", lines)
	}
}

func TestReadLinesCapsHugeLines(t *testing.T) {
	huge := "2026-01-01T00:00:00Z " + strings.Repeat("x", 2*maxLogLineBytes) + "\n2026-01-01T00:00:01Z after\n"
	lines, _, err := ReadLines(strings.NewReader(huge), Cursor{}, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 2 || len(lines[0].Line) > maxLogLineBytes || lines[1].Line != "after" {
		t.Fatalf("unexpected result: %d lines, first %d bytes", len(lines), len(lines[0].Line))
	}
}
