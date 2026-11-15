package gitremote

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
)

const (
	userAgent        = "git/2.45.0 (metorial-origin)"
	maxRedirects     = 5
	maxErrorBodySize = 2048
)

var ErrUnauthorized = errors.New("gitremote: the git server rejected the credentials")
var ErrRepositoryNotFound = errors.New("gitremote: repository not found")

// BasicAuth renders an Authorization header value. GitHub expects
// ("x-access-token", token), GitLab ("oauth2", token), Bitbucket Cloud
// ("x-token-auth", token) and Bitbucket Data Center the user and token.
func BasicAuth(username, token string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(username+":"+token))
}

// Remote is a smart-HTTP repository endpoint. Credentials only ever travel in the
// Authorization header; redirects to another host or to plain HTTP are refused.
type Remote struct {
	URL        string
	AuthHeader string
	HTTPClient *http.Client
	// AllowHTTP permits plain-HTTP URLs; tests only.
	AllowHTTP bool
}

func (r Remote) endpoint(path string) (*url.URL, error) {
	parsed, err := url.Parse(r.URL)
	if err != nil || parsed.Host == "" {
		return nil, errors.New("gitremote: invalid repository URL")
	}
	if parsed.User != nil {
		return nil, errors.New("gitremote: repository URL must not contain credentials")
	}
	if parsed.Scheme != "https" && !(r.AllowHTTP && parsed.Scheme == "http") {
		return nil, errors.New("gitremote: repository URL must use HTTPS")
	}

	endpointPath, query, _ := strings.Cut(path, "?")
	parsed.RawQuery, parsed.Fragment = query, ""
	parsed.Path = strings.TrimSuffix(parsed.Path, "/") + endpointPath
	parsed.RawPath = ""
	return parsed, nil
}

func (r Remote) client() *http.Client {
	base := r.HTTPClient
	if base == nil {
		base = http.DefaultClient
	}

	client := *base
	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if len(via) >= maxRedirects {
			return fmt.Errorf("%w: too many redirects", ErrRedirect)
		}
		original := via[0].URL
		if req.URL.Host != original.Host || (original.Scheme == "https" && req.URL.Scheme != "https") {
			return ErrRedirect
		}
		return nil
	}
	return &client
}

// Do sends a request to the repository endpoint path (e.g. "/git-receive-pack") and
// maps non-2xx responses to errors (*commitbatch.RateLimitedError for 429).
func (r Remote) Do(ctx context.Context, method, path string, body io.Reader, header http.Header) (*http.Response, error) {
	endpoint, err := r.endpoint(path)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint.String(), body)
	if err != nil {
		return nil, err
	}
	for key, values := range header {
		req.Header[key] = values
	}
	req.Header.Set("User-Agent", userAgent)
	if r.AuthHeader != "" {
		req.Header.Set("Authorization", r.AuthHeader)
	}

	resp, err := r.client().Do(req)
	if err != nil {
		if errors.Is(err, ErrRedirect) {
			return nil, ErrRedirect
		}
		return nil, fmt.Errorf("gitremote: %s %s: %w", method, endpoint.Path, scrubURLError(err))
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		defer resp.Body.Close()
		return nil, statusError(resp, method+" "+endpoint.Path)
	}
	return resp, nil
}

// scrubURLError drops the URL from *url.Error, which can carry query strings.
func scrubURLError(err error) error {
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return urlErr.Err
	}
	return err
}

// HTTPError is a non-2xx response from the git server.
type HTTPError struct {
	Op         string
	StatusCode int
	Body       string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("gitremote: %s returned status %d: %s", e.Op, e.StatusCode, e.Body)
}

func statusError(resp *http.Response, op string) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, maxErrorBodySize))
	httpErr := &HTTPError{Op: op, StatusCode: resp.StatusCode, Body: printable(body)}

	switch {
	case resp.StatusCode == http.StatusTooManyRequests || (resp.StatusCode == http.StatusServiceUnavailable && resp.Header.Get("Retry-After") != ""):
		return &commitbatch.RateLimitedError{RetryAfter: RetryAfter(resp.Header, time.Now()), Err: httpErr}
	case resp.StatusCode == http.StatusUnauthorized:
		return fmt.Errorf("%w: %w", ErrUnauthorized, httpErr)
	case resp.StatusCode == http.StatusNotFound:
		return fmt.Errorf("%w: %w", ErrRepositoryNotFound, httpErr)
	}
	return httpErr
}

// RetryAfter reads Retry-After (seconds or HTTP date), RateLimit-Reset (GitLab,
// Unix time) and x-ratelimit-reset (GitHub, Unix time). Zero means none was given.
func RetryAfter(header http.Header, now time.Time) time.Time {
	if value := strings.TrimSpace(header.Get("Retry-After")); value != "" {
		if seconds, err := strconv.ParseInt(value, 10, 64); err == nil && seconds >= 0 {
			return now.Add(time.Duration(seconds) * time.Second)
		}
		if at, err := http.ParseTime(value); err == nil {
			return at
		}
	}

	for _, name := range []string{"RateLimit-Reset", "X-RateLimit-Reset"} {
		value := strings.TrimSpace(header.Get(name))
		if value == "" {
			continue
		}
		if unix, err := strconv.ParseInt(value, 10, 64); err == nil && unix > 0 {
			// RateLimit-Reset is a Unix timestamp on GitLab but a delta in the IETF draft.
			if unix < 1_000_000_000 {
				return now.Add(time.Duration(unix) * time.Second)
			}
			return time.Unix(unix, 0)
		}
	}

	return time.Time{}
}

// limitedBody fails once more than limit bytes have been read.
type limitedBody struct {
	r         io.Reader
	remaining int64
	err       error
}

func newLimitedBody(r io.Reader, limit int64, err error) *limitedBody {
	return &limitedBody{r: r, remaining: limit, err: err}
}

func (l *limitedBody) Read(p []byte) (int, error) {
	if l.remaining <= 0 {
		var probe [1]byte
		if n, _ := l.r.Read(probe[:]); n > 0 {
			return 0, l.err
		}
		return 0, io.EOF
	}
	if int64(len(p)) > l.remaining {
		p = p[:l.remaining]
	}
	n, err := l.r.Read(p)
	l.remaining -= int64(n)
	return n, err
}
