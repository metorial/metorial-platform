// Package protocol implements the supervisor ↔ worker wire format documented in
// services/functions/packages/runtime-node/PROTOCOL.md: 4-byte big-endian length, then a JSON
// object with a "type" field.
package protocol

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sync"
)

const MaxFrameBytes = 64 << 20

const (
	TypeReady  = "ready"
	TypeResult = "result"
	TypeLog    = "log"
	TypeCrash  = "crash"
	TypeLookup = "lookup"

	TypeInvoke       = "invoke"
	TypeCancel       = "cancel"
	TypeLookupResult = "lookupResult"
	TypeTunnelError  = "tunnelError"
	TypeTunnelReady  = "tunnelReady"

	TypeTunnel = "tunnel"
)

const (
	PhaseBoot    = "boot"
	PhaseRuntime = "runtime"
)

var ErrFrameTooLarge = errors.New("protocol: frame too large")

type InvokeContext struct {
	InvocationID string `json:"invocationId"`
	DeadlineMs   int64  `json:"deadlineMs"`
}

type Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Status  int    `json:"status,omitempty"`
	Reason  string `json:"reason,omitempty"`
}

type Frame struct {
	Type      string          `json:"type"`
	RequestID string          `json:"requestId,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
	Context   *InvokeContext  `json:"context,omitempty"`

	TS     int64  `json:"ts,omitempty"`
	Stream string `json:"stream,omitempty"`
	Line   string `json:"line,omitempty"`

	ID        string   `json:"id,omitempty"`
	Hostname  string   `json:"hostname,omitempty"`
	Addresses []string `json:"addresses,omitempty"`

	TunnelID string `json:"tunnelId,omitempty"`
	Host     string `json:"host,omitempty"`
	Port     int    `json:"port,omitempty"`

	Phase   string `json:"phase,omitempty"`
	Message string `json:"message,omitempty"`
	Stack   string `json:"stack,omitempty"`

	Error *Error `json:"error,omitempty"`
}

func Encode(f *Frame) ([]byte, error) {
	body, err := json.Marshal(f)
	if err != nil {
		return nil, err
	}
	if len(body) > MaxFrameBytes {
		return nil, ErrFrameTooLarge
	}

	buf := make([]byte, 4+len(body))
	binary.BigEndian.PutUint32(buf, uint32(len(body)))
	copy(buf[4:], body)
	return buf, nil
}

func Read(r io.Reader) (*Frame, error) {
	var header [4]byte
	if _, err := io.ReadFull(r, header[:]); err != nil {
		return nil, err
	}

	size := binary.BigEndian.Uint32(header[:])
	if size > MaxFrameBytes {
		return nil, ErrFrameTooLarge
	}

	body := make([]byte, size)
	if _, err := io.ReadFull(r, body); err != nil {
		if errors.Is(err, io.EOF) {
			err = io.ErrUnexpectedEOF
		}
		return nil, err
	}

	f := new(Frame)
	if err := json.Unmarshal(body, f); err != nil {
		return nil, fmt.Errorf("protocol: invalid frame: %w", err)
	}
	if f.Type == "" {
		return nil, errors.New("protocol: frame without type")
	}
	return f, nil
}

// Writer serializes frames from concurrent goroutines onto one connection.
type Writer struct {
	mu sync.Mutex
	w  io.Writer
}

func NewWriter(w io.Writer) *Writer {
	return &Writer{w: w}
}

func (w *Writer) Write(f *Frame) error {
	buf, err := Encode(f)
	if err != nil {
		return err
	}

	w.mu.Lock()
	defer w.mu.Unlock()
	_, err = w.w.Write(buf)
	return err
}
