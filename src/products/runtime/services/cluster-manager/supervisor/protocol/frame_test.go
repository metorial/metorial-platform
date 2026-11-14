package protocol

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"sync"
	"testing"
)

func TestRoundTrip(t *testing.T) {
	var buf bytes.Buffer
	w := NewWriter(&buf)

	frames := []*Frame{
		{Type: TypeInvoke, RequestID: "req_1", Payload: json.RawMessage(`"{\"a\":1}"`), Context: &InvokeContext{InvocationID: "inv", DeadlineMs: 42}},
		{Type: TypeLog, RequestID: "req_1", TS: 1, Stream: "stdout", Line: "héllo"},
		{Type: TypeResult, RequestID: "req_1", Payload: json.RawMessage(`{"statusCode":200,"body":{"result":1}}`)},
		{Type: TypeTunnelError, TunnelID: "t1", Error: &Error{Code: "ECONNREFUSED", Message: "denied", Status: 403, Reason: "policy"}},
	}
	for _, f := range frames {
		if err := w.Write(f); err != nil {
			t.Fatal(err)
		}
	}

	for _, want := range frames {
		got, err := Read(&buf)
		if err != nil {
			t.Fatal(err)
		}
		wantJSON, _ := json.Marshal(want)
		gotJSON, _ := json.Marshal(got)
		if !bytes.Equal(wantJSON, gotJSON) {
			t.Fatalf("got %s, want %s", gotJSON, wantJSON)
		}
	}

	if _, err := Read(&buf); !errors.Is(err, io.EOF) {
		t.Fatalf("expected EOF, got %v", err)
	}
}

func TestRejectsOversizedAndTruncated(t *testing.T) {
	var header [4]byte
	binary.BigEndian.PutUint32(header[:], MaxFrameBytes+1)
	if _, err := Read(bytes.NewReader(header[:])); !errors.Is(err, ErrFrameTooLarge) {
		t.Fatalf("expected ErrFrameTooLarge, got %v", err)
	}

	buf, _ := Encode(&Frame{Type: TypeReady})
	if _, err := Read(bytes.NewReader(buf[:len(buf)-1])); !errors.Is(err, io.ErrUnexpectedEOF) {
		t.Fatalf("expected ErrUnexpectedEOF, got %v", err)
	}

	binary.BigEndian.PutUint32(header[:], 2)
	if _, err := Read(bytes.NewReader(append(header[:], '{', '}'))); err == nil || !strings.Contains(err.Error(), "without type") {
		t.Fatalf("expected missing type error, got %v", err)
	}
}

func TestConcurrentWritesDoNotInterleave(t *testing.T) {
	var buf bytes.Buffer
	w := NewWriter(&buf)

	var wg sync.WaitGroup
	for i := range 50 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = w.Write(&Frame{Type: TypeLog, Line: strings.Repeat("x", 1000+i)})
		}()
	}
	wg.Wait()

	for range 50 {
		if _, err := Read(&buf); err != nil {
			t.Fatal(err)
		}
	}
}
