package gitpush

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/go-git/go-git/v5/plumbing/format/pktline"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
)

const (
	maxReportLines = 1000
	maxReportBytes = 1 << 20
)

// RejectedError is a ref update the server refused ("ng <ref> <reason>") or a pack it
// couldn't unpack.
type RejectedError struct {
	Ref    string
	Reason string
}

func (e *RejectedError) Error() string {
	if e.Ref == "" {
		return "git server could not unpack the pushed pack: " + e.Reason
	}
	return fmt.Sprintf("git server rejected the update of %s: %s", e.Ref, e.Reason)
}

// NonFastForward reports whether the rejection may mean the branch moved under us.
func (e *RejectedError) NonFastForward() bool {
	reason := strings.ToLower(e.Reason)
	for _, marker := range []string{"non-fast-forward", "fetch first", "stale info", "failed to update ref", "failed to lock", "cannot lock ref", "reference already exists", "incorrect old value", "atomic transaction failed", "atomic push failed"} {
		if strings.Contains(reason, marker) {
			return true
		}
	}
	return false
}

// parseReportStatus reads a report-status response for a single ref update.
func parseReportStatus(r io.Reader, ref string) error {
	scanner := pktline.NewScanner(bufio.NewReader(io.LimitReader(r, maxReportBytes)))

	var (
		unpacked bool
		result   error
		seenRef  bool
	)
	for lines := 0; scanner.Scan(); lines++ {
		if lines > maxReportLines {
			return fmt.Errorf("%w: report-status too long", gitremote.ErrProtocol)
		}

		line := strings.TrimSuffix(string(scanner.Bytes()), "\n")
		switch {
		case line == "":
			if !unpacked {
				return fmt.Errorf("%w: report-status without unpack line", gitremote.ErrProtocol)
			}
			if !seenRef {
				return fmt.Errorf("%w: report-status does not mention %s", gitremote.ErrProtocol, ref)
			}
			return result

		case !unpacked:
			status, ok := strings.CutPrefix(line, "unpack ")
			if !ok {
				return fmt.Errorf("%w: expected unpack status, got %q", gitremote.ErrProtocol, sanitize(line))
			}
			if status != "ok" {
				return &RejectedError{Reason: sanitize(status)}
			}
			unpacked = true

		case strings.HasPrefix(line, "ok "):
			if strings.TrimPrefix(line, "ok ") == ref {
				seenRef = true
			}

		case strings.HasPrefix(line, "ng "):
			name, reason, _ := strings.Cut(strings.TrimPrefix(line, "ng "), " ")
			if name == ref {
				seenRef = true
				result = &RejectedError{Ref: name, Reason: sanitize(reason)}
			}

		case strings.HasPrefix(line, "option "):

		default:
			return fmt.Errorf("%w: unexpected report-status line %q", gitremote.ErrProtocol, sanitize(line))
		}
	}

	if err := scanner.Err(); err != nil {
		var errLine *pktline.ErrorLine
		if errors.As(err, &errLine) {
			return &gitremote.RemoteError{Message: sanitize(errLine.Text)}
		}
		return fmt.Errorf("%w: %v", gitremote.ErrProtocol, err)
	}
	return fmt.Errorf("%w: report-status ended without a flush", gitremote.ErrProtocol)
}

func sanitize(s string) string {
	const limit = 512

	var b strings.Builder
	for _, r := range s {
		if b.Len() >= limit {
			b.WriteString("…")
			break
		}
		if r < 0x20 || r == 0x7f {
			r = '?'
		}
		b.WriteRune(r)
	}
	return b.String()
}
