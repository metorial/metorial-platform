package gitremote

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
)

const (
	ServiceUploadPack  = "git-upload-pack"
	ServiceReceivePack = "git-receive-pack"

	ZeroSHA = "0000000000000000000000000000000000000000"

	maxRefs = 1_000_000
)

// Advertisement is a parsed info/refs response. For protocol v2 Refs is empty and
// the refs come from ls-refs instead.
type Advertisement struct {
	Version int
	// Refs maps ref names to object SHAs (v0/v1 only).
	Refs map[string]string
	// Capabilities holds v0 capabilities from the first ref line, or v2 capability
	// lines; the value is what follows "=", empty if there is none.
	Capabilities map[string]string
}

func (a *Advertisement) Has(capability string) bool {
	_, ok := a.Capabilities[capability]
	return ok
}

// V2Feature reports whether a v2 command advertises a feature, e.g.
// V2Feature("fetch", "filter") for "fetch=shallow filter".
func (a *Advertisement) V2Feature(command, feature string) bool {
	value, ok := a.Capabilities[command]
	if !ok {
		return false
	}
	for _, f := range strings.Fields(value) {
		if f == feature {
			return true
		}
	}
	return false
}

// Discover fetches and parses info/refs for service. protocolV2 asks the server
// for protocol v2, which it may ignore.
func (r Remote) Discover(ctx context.Context, service string, protocolV2 bool, limit int64) (*Advertisement, error) {
	header := http.Header{}
	if protocolV2 {
		header.Set("Git-Protocol", "version=2")
	}

	resp, err := r.Do(ctx, http.MethodGet, "/info/refs?service="+service, nil, header)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if contentType := resp.Header.Get("Content-Type"); contentType != "" && contentType != "application/x-"+service+"-advertisement" {
		return nil, fmt.Errorf("%w: server does not speak smart HTTP (content type %q)", ErrProtocol, printable([]byte(contentType)))
	}

	return ParseAdvertisement(newLimitedBody(resp.Body, limit, ErrTooLarge), service)
}

// ParseAdvertisement parses a smart-HTTP info/refs body: an optional
// "# service=" preamble, then a v0/v1 ref advertisement or a v2 capability list.
func ParseAdvertisement(r io.Reader, service string) (*Advertisement, error) {
	packets := newPacketReader(r)
	adv := &Advertisement{Version: 0, Refs: map[string]string{}, Capabilities: map[string]string{}}

	kind, payload, err := packets.next()
	if err != nil {
		return nil, err
	}

	if kind == packetData && bytes.HasPrefix(payload, []byte("# service=")) {
		if got := string(trimLF(payload[len("# service="):])); got != service {
			return nil, fmt.Errorf("%w: advertisement is for %q", ErrProtocol, printable([]byte(got)))
		}
		if kind, _, err = packets.next(); err != nil {
			return nil, err
		}
		if kind != packetFlush {
			return nil, fmt.Errorf("%w: expected flush after service line", ErrProtocol)
		}
		if kind, payload, err = packets.next(); err != nil {
			return nil, err
		}
	}

	if kind == packetData && string(trimLF(payload)) == "version 2" {
		adv.Version = 2
		return adv, parseV2Capabilities(packets, adv)
	}
	if kind == packetData && string(trimLF(payload)) == "version 1" {
		adv.Version = 1
		if kind, payload, err = packets.next(); err != nil {
			return nil, err
		}
	}

	first := true
	for kind != packetFlush {
		if kind != packetData {
			return nil, fmt.Errorf("%w: unexpected packet in ref advertisement", ErrProtocol)
		}

		line := trimLF(payload)
		if first {
			first = false
			refPart, caps, found := bytes.Cut(line, []byte{0})
			if !found {
				return nil, fmt.Errorf("%w: first ref line has no capabilities", ErrProtocol)
			}
			parseV0Capabilities(string(caps), adv.Capabilities)
			line = refPart
		}

		sha, name, err := parseRefLine(line)
		if err != nil {
			return nil, err
		}
		if name != "capabilities^{}" {
			if len(adv.Refs) >= maxRefs {
				return nil, fmt.Errorf("%w: too many refs", ErrTooLarge)
			}
			adv.Refs[name] = sha
		}

		if kind, payload, err = packets.next(); err != nil {
			return nil, err
		}
	}

	if format := adv.Capabilities["object-format"]; format != "" && format != "sha1" {
		return nil, fmt.Errorf("gitremote: unsupported object format %q", printable([]byte(format)))
	}
	return adv, nil
}

func parseV0Capabilities(caps string, into map[string]string) {
	for _, capability := range strings.Fields(caps) {
		name, value, _ := strings.Cut(capability, "=")
		if _, exists := into[name]; !exists {
			into[name] = value
		}
	}
}

func parseV2Capabilities(packets *packetReader, adv *Advertisement) error {
	for {
		kind, payload, err := packets.next()
		if err != nil {
			return err
		}
		if kind == packetFlush {
			break
		}
		if kind != packetData {
			return fmt.Errorf("%w: unexpected packet in capability advertisement", ErrProtocol)
		}

		name, value, _ := strings.Cut(string(trimLF(payload)), "=")
		if name == "" {
			return fmt.Errorf("%w: empty capability", ErrProtocol)
		}
		adv.Capabilities[name] = value
	}

	if format := adv.Capabilities["object-format"]; format != "" && format != "sha1" {
		return fmt.Errorf("gitremote: unsupported object format %q", printable([]byte(format)))
	}
	if !adv.Has("fetch") || !adv.Has("ls-refs") {
		return fmt.Errorf("%w: protocol v2 server without fetch and ls-refs", ErrProtocol)
	}
	return nil
}

func parseRefLine(line []byte) (sha, name string, err error) {
	shaPart, namePart, found := bytes.Cut(line, []byte(" "))
	if !found || !isSHA(string(shaPart)) || len(namePart) == 0 {
		return "", "", fmt.Errorf("%w: malformed ref line %q", ErrProtocol, printable(line))
	}
	if i := bytes.IndexByte(namePart, ' '); i >= 0 {
		namePart = namePart[:i]
	}
	if len(namePart) == 0 || bytes.IndexByte(namePart, 0) >= 0 {
		return "", "", fmt.Errorf("%w: malformed ref line %q", ErrProtocol, printable(line))
	}
	return string(shaPart), string(namePart), nil
}

func isSHA(s string) bool {
	if len(s) != 40 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !('0' <= c && c <= '9' || 'a' <= c && c <= 'f') {
			return false
		}
	}
	return true
}
