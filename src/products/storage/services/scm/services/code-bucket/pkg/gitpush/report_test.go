package gitpush

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
)

const ref = "refs/heads/main"

func pkt(lines ...string) string {
	var b strings.Builder
	for _, line := range lines {
		if line == "" {
			b.WriteString("0000")
			continue
		}
		fmt.Fprintf(&b, "%04x%s", len(line)+4, line)
	}
	return b.String()
}

func TestParseReportStatus(t *testing.T) {
	tests := []struct {
		name           string
		body           string
		ok             bool
		rejected       bool
		nonFastForward bool
		protocol       bool
		remote         bool
	}{
		{name: "ok", body: pkt("unpack ok\n", "ok "+ref+"\n", ""), ok: true},
		{name: "ok without newlines", body: pkt("unpack ok", "ok "+ref, ""), ok: true},
		{name: "options", body: pkt("unpack ok\n", "ok "+ref+"\n", "option refname "+ref+"\n", ""), ok: true},
		{name: "non-fast-forward", body: pkt("unpack ok\n", "ng "+ref+" non-fast-forward\n", ""), rejected: true, nonFastForward: true},
		{name: "fetch first", body: pkt("unpack ok\n", "ng "+ref+" fetch first\n", ""), rejected: true, nonFastForward: true},
		{name: "atomic", body: pkt("unpack ok\n", "ng "+ref+" atomic transaction failed\n", ""), rejected: true, nonFastForward: true},
		{name: "hook", body: pkt("unpack ok\n", "ng "+ref+" pre-receive hook declined\n", ""), rejected: true},
		{name: "protected", body: pkt("unpack ok\n", "ng "+ref+" protected branch hook declined\n", ""), rejected: true},
		{name: "unpack failed", body: pkt("unpack index-pack abnormal exit\n", "ng "+ref+" unpacker error\n", ""), rejected: true},
		{name: "other ref only", body: pkt("unpack ok\n", "ok refs/heads/other\n", ""), protocol: true},
		{name: "no flush", body: pkt("unpack ok\n", "ok "+ref+"\n"), protocol: true},
		{name: "empty", body: "", protocol: true},
		{name: "garbage", body: "HTTP/1.1 200 OK", protocol: true},
		{name: "flush first", body: pkt(""), protocol: true},
		{name: "unknown line", body: pkt("unpack ok\n", "what "+ref+"\n", ""), protocol: true},
		{name: "ERR", body: pkt("ERR repository is read-only\n"), remote: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := parseReportStatus(strings.NewReader(tt.body), ref)

			var rejected *RejectedError
			var remote *gitremote.RemoteError
			switch {
			case tt.ok && err != nil:
				t.Fatalf("err = %v", err)
			case tt.rejected && !errors.As(err, &rejected):
				t.Fatalf("err = %v, want RejectedError", err)
			case tt.rejected && rejected.NonFastForward() != tt.nonFastForward:
				t.Fatalf("NonFastForward() = %v", rejected.NonFastForward())
			case tt.protocol && !errors.Is(err, gitremote.ErrProtocol):
				t.Fatalf("err = %v, want ErrProtocol", err)
			case tt.remote && !errors.As(err, &remote):
				t.Fatalf("err = %v, want RemoteError", err)
			}
		})
	}
}

func TestParseReportStatusSanitizesServerText(t *testing.T) {
	err := parseReportStatus(strings.NewReader(pkt("unpack ok\n", "ng "+ref+" bad\x1b[31m"+strings.Repeat("x", 2000)+"\n", "")), ref)
	message := err.Error()
	if strings.Contains(message, "\x1b") || len(message) > 700 {
		t.Fatalf("unsanitized message (%d bytes): %q", len(message), message)
	}
}

func FuzzParseReportStatus(f *testing.F) {
	f.Add([]byte(pkt("unpack ok\n", "ok "+ref+"\n", "")))
	f.Add([]byte(pkt("unpack ok\n", "ng "+ref+" non-fast-forward\n", "")))
	f.Add([]byte(pkt("unpack error\n", "")))
	f.Add([]byte(pkt("ERR boom\n")))
	f.Add([]byte("ffff"))

	f.Fuzz(func(t *testing.T, data []byte) {
		err := parseReportStatus(strings.NewReader(string(data)), ref)
		if err != nil && len(err.Error()) > 4096 {
			t.Fatalf("error message is %d bytes", len(err.Error()))
		}
	})
}
