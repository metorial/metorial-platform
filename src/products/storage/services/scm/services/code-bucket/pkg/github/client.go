package github

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
)

const (
	maxReadAttempts       = 3
	secondaryLimitBackoff = time.Minute
	maxErrorBodyBytes     = 2048
	maxResponseBytes      = 64 << 20
)

// restClient talks to the REST and GraphQL APIs for manifest exports. Unlike githubJSON
// it never sleeps through rate limits: they are returned as
// commitbatch.RateLimitedError so the batcher (which waits at most a minute) or Origin's
// queue decides when to try again.
type restClient struct {
	http       *http.Client
	repoURL    string
	graphqlURL string
	token      string

	requests atomic.Uint32
	now      func() time.Time
	sleep    func(ctx context.Context, d time.Duration) error
}

// apiError is a non-2xx response that isn't a rate limit or a size rejection.
type apiError struct {
	Method string
	URL    string
	Status int
	Body   string
}

func (e *apiError) Error() string {
	return fmt.Sprintf("%s %s failed (status %d): %s", e.Method, e.URL, e.Status, e.Body)
}

// transportError means no response arrived, so a write may or may not have happened.
type transportError struct {
	Method string
	URL    string
	Err    error
}

func (e *transportError) Error() string {
	return fmt.Sprintf("%s %s: %v", e.Method, e.URL, e.Err)
}

func (e *transportError) Unwrap() error { return e.Err }

func graphqlEndpoint(baseURL string) string {
	if strings.HasSuffix(baseURL, "/api/v3") {
		return strings.TrimSuffix(baseURL, "/v3") + "/graphql"
	}
	return baseURL + "/graphql"
}

func escapeRef(ref string) string {
	segments := strings.Split(ref, "/")
	for i, segment := range segments {
		segments[i] = url.PathEscape(segment)
	}
	return strings.Join(segments, "/")
}

func (c *restClient) do(ctx context.Context, method, endpoint string, body, out any) error {
	_, err := c.doWithHeaders(ctx, method, endpoint, body, out)
	return err
}

func (c *restClient) doWithHeaders(ctx context.Context, method, endpoint string, body, out any) (http.Header, error) {
	var payload []byte
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("encode request: %w", err)
		}
		payload = encoded
	}

	for attempt := 1; ; attempt++ {
		header, status, respBody, err := c.send(ctx, method, endpoint, payload)
		retryable := method == http.MethodGet && attempt < maxReadAttempts && ctx.Err() == nil

		if err != nil {
			if retryable {
				if sleepErr := c.sleep(ctx, time.Duration(attempt)*time.Second); sleepErr != nil {
					return nil, sleepErr
				}
				continue
			}
			return nil, &transportError{Method: method, URL: endpoint, Err: err}
		}

		if status >= 200 && status < 300 {
			if out != nil && len(respBody) > 0 {
				if err := json.Unmarshal(respBody, out); err != nil {
					return header, fmt.Errorf("%s %s: invalid response: %w", method, endpoint, err)
				}
			}
			return header, nil
		}

		if retryAt, limited := rateLimitedUntil(status, header, respBody, c.now()); limited {
			return header, &commitbatch.RateLimitedError{
				RetryAfter: retryAt,
				Err:        &apiError{Method: method, URL: endpoint, Status: status, Body: truncateBody(respBody)},
			}
		}
		if status == http.StatusRequestEntityTooLarge {
			return header, fmt.Errorf("%s %s: %w", method, endpoint, commitbatch.ErrBodyTooLarge)
		}
		if status >= 500 && retryable {
			if sleepErr := c.sleep(ctx, time.Duration(attempt)*time.Second); sleepErr != nil {
				return nil, sleepErr
			}
			continue
		}

		return header, &apiError{Method: method, URL: endpoint, Status: status, Body: truncateBody(respBody)}
	}
}

func (c *restClient) send(ctx context.Context, method, endpoint string, payload []byte) (http.Header, int, []byte, error) {
	var reader io.Reader
	if payload != nil {
		reader = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return nil, 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	c.requests.Add(1)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, 0, nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes))
	if err != nil {
		return nil, 0, nil, err
	}
	return resp.Header, resp.StatusCode, respBody, nil
}

func truncateBody(body []byte) string {
	if len(body) > maxErrorBodyBytes {
		return string(body[:maxErrorBodyBytes]) + "…"
	}
	return string(body)
}

// rateLimitedUntil classifies GitHub's primary and secondary rate limits and returns
// when to retry: Retry-After first, then x-ratelimit-reset when the quota is spent,
// otherwise a minute, which is what GitHub asks for on secondary limits.
func rateLimitedUntil(status int, header http.Header, body []byte, now time.Time) (time.Time, bool) {
	exhausted := header.Get("X-RateLimit-Remaining") == "0"
	limited := status == http.StatusTooManyRequests ||
		(status == http.StatusForbidden && (exhausted || mentionsRateLimit(body)))
	if !limited {
		return time.Time{}, false
	}
	return retryAt(header, now), true
}

func retryAt(header http.Header, now time.Time) time.Time {
	if value := header.Get("Retry-After"); value != "" {
		if seconds, err := strconv.Atoi(value); err == nil && seconds >= 0 {
			return now.Add(time.Duration(seconds) * time.Second)
		}
		if at, err := http.ParseTime(value); err == nil {
			return at
		}
	}
	if header.Get("X-RateLimit-Remaining") == "0" {
		if reset, err := strconv.ParseInt(header.Get("X-RateLimit-Reset"), 10, 64); err == nil && reset > 0 {
			return time.Unix(reset, 0)
		}
	}
	return now.Add(secondaryLimitBackoff)
}

func mentionsRateLimit(body []byte) bool {
	return strings.Contains(strings.ToLower(string(body)), "rate limit")
}

type graphqlError struct {
	Type       string `json:"type"`
	Message    string `json:"message"`
	Extensions struct {
		Code string `json:"code"`
	} `json:"extensions"`
}

type graphqlErrors []graphqlError

func (e graphqlErrors) Error() string {
	messages := make([]string, len(e))
	for i, err := range e {
		messages[i] = err.Message
		if err.Type != "" {
			messages[i] = err.Type + ": " + err.Message
		}
	}
	return "GraphQL: " + strings.Join(messages, "; ")
}

func (c *restClient) graphql(ctx context.Context, query string, variables, data any) error {
	var resp struct {
		Data   json.RawMessage `json:"data"`
		Errors graphqlErrors   `json:"errors"`
	}

	header, err := c.doWithHeaders(ctx, http.MethodPost, c.graphqlURL, map[string]any{"query": query, "variables": variables}, &resp)
	if err != nil {
		return err
	}

	if len(resp.Errors) > 0 {
		for _, e := range resp.Errors {
			if e.Type == "RATE_LIMITED" {
				return &commitbatch.RateLimitedError{RetryAfter: retryAt(header, c.now()), Err: resp.Errors}
			}
		}
		return resp.Errors
	}

	if data != nil && len(resp.Data) > 0 {
		if err := json.Unmarshal(resp.Data, data); err != nil {
			return fmt.Errorf("GraphQL: invalid response: %w", err)
		}
	}
	return nil
}

func isStatus(err error, statuses ...int) bool {
	var apiErr *apiError
	if !errors.As(err, &apiErr) {
		return false
	}
	for _, status := range statuses {
		if apiErr.Status == status {
			return true
		}
	}
	return false
}
