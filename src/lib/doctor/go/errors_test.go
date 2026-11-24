package doctor

import (
	"context"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"syscall"
	"testing"
	"time"
)

type codedError struct{ code string }

func (e codedError) Error() string     { return "aws said " + e.code }
func (e codedError) ErrorCode() string { return e.code }

type sqlStateError struct{ state string }

func (e sqlStateError) Error() string    { return "pg said " + e.state }
func (e sqlStateError) SQLState() string { return e.state }

type statusError struct{ status int }

func (e statusError) Error() string       { return fmt.Sprintf("status %d", e.status) }
func (e statusError) HTTPStatusCode() int { return e.status }

func TestErrorTablesMatchFixture(t *testing.T) {
	var fixture struct {
		Codes      map[string]ErrorKind `json:"codes"`
		HTTPStatus map[string]ErrorKind `json:"httpStatus"`
		Hints      map[ErrorKind]string `json:"hints"`
	}
	if err := json.Unmarshal(readFixture(t, "error-codes.json"), &fixture); err != nil {
		t.Fatal(err)
	}

	compare(t, "codes", fixture.Codes, ErrorCodeKinds)
	compare(t, "httpStatus", fixture.HTTPStatus, HTTPStatusKinds)
	compare(t, "hints", fixture.Hints, ErrorKindHints)
}

func compare[K comparable, V comparable](t *testing.T, name string, want, got map[K]V) {
	t.Helper()

	for key, value := range want {
		if got[key] != value {
			t.Errorf("%s[%v] = %v, want %v", name, key, got[key], value)
		}
	}
	for key := range got {
		if _, ok := want[key]; !ok {
			t.Errorf("%s[%v] is not in the fixture", name, key)
		}
	}
}

func TestDescribeError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		kind ErrorKind
		code string
	}{
		{"aws code", codedError{"KMSInvalidStateException"}, KindInvalidState, "KMSInvalidStateException"},
		{"wrapped aws code", fmt.Errorf("encrypt: %w", codedError{"AccessDeniedException"}), KindPermission, "AccessDeniedException"},
		{"sql state", sqlStateError{"28P01"}, KindAuthentication, "28P01"},
		{"errno", &net.OpError{Op: "dial", Net: "tcp", Err: &os.SyscallError{Syscall: "connect", Err: syscall.ECONNREFUSED}}, KindConnectionRefused, "ECONNREFUSED"},
		{"dns not found", &net.DNSError{Err: "no such host", Name: "db.internal", IsNotFound: true}, KindDNS, "ENOTFOUND"},
		{"dns other", &net.DNSError{Err: "server misbehaving", Name: "db.internal"}, KindDNS, ""},
		{"expired certificate", x509.CertificateInvalidError{Reason: x509.Expired}, KindTLS, "CERT_HAS_EXPIRED"},
		{"hostname mismatch", x509.HostnameError{Certificate: &x509.Certificate{}, Host: "db"}, KindTLS, "ERR_TLS_CERT_ALTNAME_INVALID"},
		{"http status", statusError{503}, KindUnavailable, "HTTP 503"},
		{"unknown code keeps code", fmt.Errorf("x: %w", errors.Join(codedError{"Weird"}, statusError{429})), KindLimit, "Weird"},
		{"deadline", fmt.Errorf("query: %w", context.DeadlineExceeded), KindTimeout, ""},
		{"unknown", errors.New("boom"), KindUnknown, ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			info := DescribeError(tc.err)
			if info.Kind != tc.kind {
				t.Fatalf("kind = %s, want %s", info.Kind, tc.kind)
			}

			code := ""
			if info.Code != nil {
				code = *info.Code
			}
			if code != tc.code {
				t.Fatalf("code = %q, want %q", code, tc.code)
			}

			if (info.Hint == nil) != (tc.kind == KindUnknown) {
				t.Fatalf("hint = %v for kind %s", info.Hint, tc.kind)
			}
		})
	}
}

func TestDescribeErrorRedactsMessage(t *testing.T) {
	err := fmt.Errorf("connect postgres://app:hunter2@db:5432/core: %w", syscall.ECONNREFUSED)
	info := DescribeError(err)

	if info.Message != "connect postgres://app:***@db:5432/core: connection refused" {
		t.Fatalf("message = %q", info.Message)
	}
}

func TestDescribeErrorNetTimeout(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skip(err)
	}
	defer listener.Close()

	connection, err := net.Dial("tcp", listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()

	_ = connection.SetReadDeadline(time.Now().Add(time.Millisecond))
	_, err = connection.Read(make([]byte, 1))

	if kind := DescribeError(err).Kind; kind != KindTimeout {
		t.Fatalf("kind = %s, want timeout", kind)
	}
}
