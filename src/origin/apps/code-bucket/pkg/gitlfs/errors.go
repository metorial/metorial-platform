package gitlfs

import (
	"errors"
	"fmt"
	"net/http"
)

// Git LFS failures that callers need to distinguish from a generic transport
// error, because the operator action differs for each.
var (
	// ErrForbidden covers a server that refuses the operation outright: LFS
	// disabled on the repository, or a token without write access.
	ErrForbidden = errors.New("Git LFS refused the request; the repository may have LFS disabled or the token may lack write access")

	// ErrQuotaExceeded covers exhausted LFS storage or bandwidth, which GitHub
	// reports as 429 rather than a dedicated status.
	ErrQuotaExceeded = errors.New("Git LFS quota exceeded or rate limited; check the account's LFS storage and bandwidth allowance")

	// ErrUnauthorized covers a missing or rejected credential.
	ErrUnauthorized = errors.New("Git LFS rejected the credentials")

	// ErrObjectNotFound is returned when a download references an object the
	// server does not hold.
	ErrObjectNotFound = errors.New("Git LFS object not found on the server")
)

// Error carries the HTTP context of a failed Git LFS call alongside a sentinel
// that callers can match with errors.Is.
type Error struct {
	Op         string
	URL        string
	StatusCode int
	Body       string

	kind error
}

func (e *Error) Error() string {
	if e.kind != nil {
		return fmt.Sprintf("%s: %s (status %d): %s", e.Op, e.kind, e.StatusCode, e.Body)
	}
	return fmt.Sprintf("%s failed (status %d): %s", e.Op, e.StatusCode, e.Body)
}

func (e *Error) Unwrap() error { return e.kind }

func newError(op, url string, statusCode int, body string) *Error {
	return &Error{
		Op:         op,
		URL:        url,
		StatusCode: statusCode,
		Body:       truncate(body, 512),
		kind:       kindForStatus(statusCode),
	}
}

func kindForStatus(statusCode int) error {
	switch statusCode {
	case http.StatusUnauthorized:
		return ErrUnauthorized
	case http.StatusForbidden:
		return ErrForbidden
	case http.StatusTooManyRequests:
		return ErrQuotaExceeded
	case http.StatusNotFound, http.StatusGone:
		return ErrObjectNotFound
	default:
		return nil
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
