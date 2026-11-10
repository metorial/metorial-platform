package gitremote

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/go-git/go-git/v5/plumbing/format/pktline"
)

type packetKind int

const (
	packetData packetKind = iota
	packetFlush
	packetDelim
	packetResponseEnd
)

const maxPacketLen = pktline.OversizePayloadMax + 4

var (
	ErrProtocol = errors.New("gitremote: malformed server response")
	flushPacket = []byte("0000")
	delimPacket = []byte("0001")
)

// RemoteError is an "ERR <message>" packet or a side-band error from the server.
type RemoteError struct {
	Message string
}

func (e *RemoteError) Error() string { return "git server error: " + e.Message }

// packetReader reads pkt-lines, including the protocol v2 delim (0001) and
// response-end (0002) packets that go-git's pktline.Scanner rejects.
type packetReader struct {
	r   *bufio.Reader
	buf []byte
}

func newPacketReader(r io.Reader) *packetReader {
	if br, ok := r.(*bufio.Reader); ok {
		return &packetReader{r: br}
	}
	return &packetReader{r: bufio.NewReaderSize(r, 64<<10)}
}

// peekPack reports whether the next bytes are a raw (not pkt-line framed) packfile.
func (p *packetReader) peekPack() bool {
	head, err := p.r.Peek(4)
	return err == nil && string(head) == "PACK"
}

// next returns the next packet. The payload is only valid until the following call.
func (p *packetReader) next() (packetKind, []byte, error) {
	var header [4]byte
	if _, err := io.ReadFull(p.r, header[:]); err != nil {
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			return 0, nil, fmt.Errorf("%w: %w", ErrProtocol, io.ErrUnexpectedEOF)
		}
		return 0, nil, err
	}

	n, ok := parseHex16(header)
	if !ok {
		return 0, nil, fmt.Errorf("%w: invalid pkt-line length %q", ErrProtocol, printable(header[:]))
	}

	switch {
	case n == 0:
		return packetFlush, nil, nil
	case n == 1:
		return packetDelim, nil, nil
	case n == 2:
		return packetResponseEnd, nil, nil
	case n < 4 || n > maxPacketLen:
		return 0, nil, fmt.Errorf("%w: invalid pkt-line length %d", ErrProtocol, n)
	}

	if cap(p.buf) < n-4 {
		p.buf = make([]byte, n-4, maxPacketLen)
	}
	p.buf = p.buf[:n-4]
	if _, err := io.ReadFull(p.r, p.buf); err != nil {
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			return 0, nil, fmt.Errorf("%w: truncated pkt-line", ErrProtocol)
		}
		return 0, nil, err
	}

	if rest, found := bytes.CutPrefix(p.buf, []byte("ERR ")); found {
		return 0, nil, &RemoteError{Message: strings.TrimSpace(printable(rest))}
	}

	return packetData, p.buf, nil
}

func parseHex16(b [4]byte) (int, bool) {
	n := 0
	for _, c := range b {
		var v byte
		switch {
		case '0' <= c && c <= '9':
			v = c - '0'
		case 'a' <= c && c <= 'f':
			v = c - 'a' + 10
		case 'A' <= c && c <= 'F':
			v = c - 'A' + 10
		default:
			return 0, false
		}
		n = n<<4 | int(v)
	}
	return n, true
}

// printable makes server-controlled bytes safe to put into an error message.
func printable(b []byte) string {
	const limit = 256

	var sb strings.Builder
	for _, r := range string(b) {
		if sb.Len() >= limit {
			sb.WriteString("…")
			break
		}
		if r < 0x20 || r == 0x7f || r == '\uFFFD' {
			sb.WriteByte('?')
			continue
		}
		sb.WriteRune(r)
	}
	return sb.String()
}

func trimLF(b []byte) []byte {
	return bytes.TrimSuffix(b, []byte("\n"))
}

// sidebandReader demultiplexes side-band-64k packets: channel 1 is data, 2 is
// progress (dropped, bounded), 3 is a fatal error. A flush ends the stream.
type sidebandReader struct {
	packets       *packetReader
	pending       []byte
	progressBytes int64
	done          bool
}

const maxProgressBytes = 4 << 20

func (s *sidebandReader) Read(p []byte) (int, error) {
	for len(s.pending) == 0 {
		if s.done {
			return 0, io.EOF
		}

		kind, payload, err := s.packets.next()
		if err != nil {
			return 0, err
		}
		if kind != packetData {
			s.done = true
			continue
		}
		if len(payload) == 0 {
			return 0, fmt.Errorf("%w: empty side-band packet", ErrProtocol)
		}

		switch payload[0] {
		case 1:
			s.pending = payload[1:]
		case 2:
			s.progressBytes += int64(len(payload))
			if s.progressBytes > maxProgressBytes {
				return 0, fmt.Errorf("%w: too much progress output", ErrTooLarge)
			}
		case 3:
			return 0, &RemoteError{Message: strings.TrimSpace(printable(payload[1:]))}
		default:
			return 0, fmt.Errorf("%w: unknown side-band channel %d", ErrProtocol, payload[0])
		}
	}

	n := copy(p, s.pending)
	s.pending = s.pending[n:]
	return n, nil
}

func encodePacket(w *bytes.Buffer, format string, args ...any) {
	_ = pktline.NewEncoder(w).Encodef(format, args...)
}
