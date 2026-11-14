package gitlfs

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
)

var (
	ErrForbidden      = errors.New("Git LFS refused the request; the repository may have LFS disabled or the token may lack write access")
	ErrQuotaExceeded  = errors.New("Git LFS quota exceeded or rate limited; check the account's LFS storage and bandwidth allowance")
	ErrUnauthorized   = errors.New("Git LFS rejected the credentials")
	ErrObjectNotFound = errors.New("Git LFS object not found on the server")
)

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

func newError(op, href string, statusCode int, body string) *Error {
	return &Error{
		Op:         op,
		URL:        redactURL(href),
		StatusCode: statusCode,
		Body:       truncate(redactURLs(body), 512),
		kind:       kindForStatus(statusCode),
	}
}

var urlPattern = regexp.MustCompile(`https?://[^\s"'<>]+`)

// redactURL drops credentials, query and fragment: LFS action hrefs are often
// presigned, so the query is a bearer credential.
func redactURL(href string) string {
	parsed, err := url.Parse(href)
	if err != nil || parsed.Host == "" {
		return "<url>"
	}
	return (&url.URL{Scheme: parsed.Scheme, Host: parsed.Host, Path: parsed.Path}).String()
}

func redactURLs(s string) string {
	return urlPattern.ReplaceAllStringFunc(s, redactURL)
}

// transportError wraps a failed request without the URL net/http puts in the message.
func transportError(op string, err error) error {
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return fmt.Errorf("%s: %w", op, &url.Error{Op: urlErr.Op, URL: redactURL(urlErr.URL), Err: urlErr.Err})
	}
	return fmt.Errorf("%s: %w", op, err)
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
