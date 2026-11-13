package ldrpc

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"time"
)

const (
	DefaultClientTimeout   = 2 * time.Minute
	DefaultMaxAttempts     = 6
	retryDelayStep         = 20 * time.Millisecond
	retryDelayMax          = time.Second
	maxResponseBodyBytes   = 64 << 20
	transportErrorMessage  = "Unable to reach server"
	invalidResponseMessage = "Invalid response from server"
)

type ClientOptions struct {
	HTTPClient *http.Client

	Header http.Header

	// HeaderFunc runs before every attempt, e.g. to inject trace context or a fresh token.
	HeaderFunc func(ctx context.Context) (http.Header, error)

	// At most one of HMACToken and Ed25519 may be set.
	HMACToken string
	Ed25519   *Ed25519Credentials

	// Timeout bounds a call including all retries. It applies when ctx has no earlier
	// deadline. Defaults to DefaultClientTimeout.
	Timeout time.Duration

	// MaxAttempts bounds attempts for calls that fail with a 5xx error. Transport failures
	// (connection refused, a proxy answering with a non-RPC 5xx) are retried until the
	// deadline instead. Defaults to DefaultMaxAttempts.
	MaxAttempts int

	DisableRetry bool

	// DirectRoute sends single calls as POST <endpoint>/<method> with the bare payload
	// instead of a one-call batch envelope.
	DirectRoute bool
}

type Client struct {
	endpoint *url.URL
	opts     ClientOptions
	http     *http.Client
	rootID   string
	counter  atomic.Uint64
}

func NewClient(endpoint string, opts ClientOptions) (*Client, error) {
	u, err := url.Parse(endpoint)
	if err != nil {
		return nil, fmt.Errorf("ldrpc: invalid endpoint: %w", err)
	}
	if opts.HMACToken != "" && opts.Ed25519 != nil {
		return nil, errors.New("ldrpc: choose one RPC signature provider")
	}

	if opts.Timeout == 0 {
		opts.Timeout = DefaultClientTimeout
	}
	if opts.MaxAttempts == 0 {
		opts.MaxAttempts = DefaultMaxAttempts
	}

	httpClient := opts.HTTPClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	return &Client{endpoint: u, opts: opts, http: httpClient, rootID: randomID()}, nil
}

type CallOption func(*callConfig)

type callConfig struct {
	header       http.Header
	query        url.Values
	timeout      time.Duration
	disableRetry bool
}

func WithHeader(key, value string) CallOption {
	return func(c *callConfig) {
		if c.header == nil {
			c.header = http.Header{}
		}
		c.header.Set(key, value)
	}
}

func WithQuery(key, value string) CallOption {
	return func(c *callConfig) {
		if c.query == nil {
			c.query = url.Values{}
		}
		c.query.Set(key, value)
	}
}

func WithTimeout(d time.Duration) CallOption {
	return func(c *callConfig) { c.timeout = d }
}

func WithoutRetry() CallOption {
	return func(c *callConfig) { c.disableRetry = true }
}

// Call invokes a method and decodes its result into a new O. Generated clients use this.
func Call[O any](ctx context.Context, c *Client, method string, input any, opts ...CallOption) (*O, error) {
	out := new(O)
	if err := c.Call(ctx, method, input, out, opts...); err != nil {
		return nil, err
	}
	return out, nil
}

// Call invokes a method; out may be nil to discard the result. Errors returned by the
// server are *Error values.
func (c *Client) Call(ctx context.Context, method string, input any, out any, opts ...CallOption) error {
	call := &BatchCall{Method: method, Input: input, Output: out}
	if err := c.do(ctx, []*BatchCall{call}, c.opts.DirectRoute, true, opts); err != nil {
		return err
	}
	return call.Err
}

type BatchCall struct {
	Method string
	Input  any
	Output any
	Err    error
}

// Batch sends several calls in one request. The returned error covers the request as a
// whole (transport failure, rejected authentication); per-call failures are in each
// BatchCall.Err. Only transport failures are retried, never individual calls.
func (c *Client) Batch(ctx context.Context, calls []*BatchCall, opts ...CallOption) error {
	if len(calls) == 0 {
		return nil
	}
	return c.do(ctx, calls, false, false, opts)
}

type attemptError struct {
	err       *Error
	transport bool
}

func (c *Client) do(ctx context.Context, calls []*BatchCall, direct, retryCallErrors bool, opts []CallOption) error {
	cfg := callConfig{timeout: c.opts.Timeout, disableRetry: c.opts.DisableRetry}
	for _, opt := range opts {
		opt(&cfg)
	}

	ctx, cancel := context.WithTimeout(ctx, cfg.timeout)
	defer cancel()

	ids := make([]string, len(calls))
	for i := range calls {
		ids[i] = fmt.Sprintf("call_%s_%d", c.rootID, c.counter.Add(1))
	}

	body, err := c.encodeBody(calls, ids, direct)
	if err != nil {
		return err
	}

	var lastErr error
	boundedFailures := 0

	for attempt := 1; ; attempt++ {
		failure := c.attempt(ctx, calls, ids, direct, body, cfg)
		if failure == nil {
			retryable := false
			for _, call := range calls {
				if e, ok := AsError(call.Err); ok && e.Status >= 500 {
					retryable = true
				}
			}
			if !retryable || !retryCallErrors || cfg.disableRetry {
				return nil
			}

			lastErr = calls[0].Err
			boundedFailures++
			if boundedFailures >= c.opts.MaxAttempts {
				return nil
			}
		} else {
			lastErr = failure.err
			if ctx.Err() != nil {
				return TimeoutError().WithCause(errors.Join(ctx.Err(), failure.err))
			}
			if cfg.disableRetry || failure.err.Status < 500 {
				return failure.err
			}
			if !failure.transport {
				boundedFailures++
				if boundedFailures >= c.opts.MaxAttempts {
					return failure.err
				}
			}
		}

		delay := min(time.Duration(attempt)*retryDelayStep, retryDelayMax)
		select {
		case <-ctx.Done():
			return TimeoutError().WithCause(errors.Join(ctx.Err(), lastErr))
		case <-time.After(delay):
		}

		for _, call := range calls {
			call.Err = nil
		}
	}
}

func (c *Client) encodeBody(calls []*BatchCall, ids []string, direct bool) ([]byte, error) {
	if direct && len(calls) == 1 {
		return Marshal(calls[0].Input)
	}

	type envelopeCall struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Payload any    `json:"payload"`
	}

	envelope := struct {
		Calls []envelopeCall `json:"calls"`
	}{Calls: make([]envelopeCall, len(calls))}

	for i, call := range calls {
		envelope.Calls[i] = envelopeCall{ID: ids[i], Name: normalizeMethodName(call.Method), Payload: call.Input}
	}
	return Marshal(envelope)
}

func (c *Client) requestURL(calls []*BatchCall, direct bool, query url.Values) *url.URL {
	u := *c.endpoint
	if direct && len(calls) == 1 {
		u.Path = strings.TrimSuffix(u.Path, "/") + "/" + strings.ReplaceAll(normalizeMethodName(calls[0].Method), ":", ".")
		u.RawPath = ""
	}
	if len(query) > 0 {
		merged := u.Query()
		for k, values := range query {
			merged[k] = values
		}
		u.RawQuery = merged.Encode()
	}
	return &u
}

func (c *Client) attempt(ctx context.Context, calls []*BatchCall, ids []string, direct bool, body []byte, cfg callConfig) *attemptError {
	u := c.requestURL(calls, direct, cfg.query)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), bytes.NewReader(body))
	if err != nil {
		return &attemptError{err: InternalServerError().WithCause(err)}
	}

	for k, values := range c.opts.Header {
		req.Header[k] = values
	}
	if c.opts.HeaderFunc != nil {
		extra, err := c.opts.HeaderFunc(ctx)
		if err != nil {
			return &attemptError{err: InternalServerError().WithCause(err)}
		}
		for k, values := range extra {
			req.Header[k] = values
		}
	}
	for k, values := range cfg.header {
		req.Header[k] = values
	}
	req.Header.Set("Content-Type", ContentType)

	switch {
	case c.opts.HMACToken != "":
		req.Header.Set(SignatureHeader, SignHMAC(c.opts.HMACToken, time.Now(), http.MethodPost, PathAndQuery(u), body))
	case c.opts.Ed25519 != nil:
		sig, err := SignEd25519(*c.opts.Ed25519, time.Now(), http.MethodPost, PathAndQuery(u), req.Header.Get("Authorization"), body)
		if err != nil {
			return &attemptError{err: InternalServerError().WithCause(err)}
		}
		req.Header.Set(SignatureHeader, sig)
	}

	res, err := c.http.Do(req)
	if err != nil {
		return &attemptError{err: InternalServerError().WithMessage(transportErrorMessage).WithCause(err), transport: true}
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(res.Body, maxResponseBodyBytes))
	if err != nil {
		return &attemptError{err: InternalServerError().WithMessage(transportErrorMessage).WithCause(err), transport: true}
	}

	plain, err := Normalize(raw)
	if err != nil {
		// RPC servers always answer with an RPC body, so an undecodable 5xx came from a proxy
		// or load balancer in front of the server and is as transient as a refused connection.
		cause := fmt.Errorf("HTTP %d: %w", res.StatusCode, err)
		if res.StatusCode >= 500 {
			return &attemptError{err: InternalServerError().WithMessage(transportErrorMessage).WithCause(cause), transport: true}
		}
		return &attemptError{err: InternalServerError().WithMessage(invalidResponseMessage).WithCause(cause)}
	}

	if direct && len(calls) == 1 {
		calls[0].Err = decodeResult(res.StatusCode, plain, calls[0].Output)
		return nil
	}

	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(plain, &envelope); err != nil {
		return &attemptError{err: InternalServerError().WithMessage(invalidResponseMessage).WithCause(err)}
	}
	if isErrorBody(envelope) {
		rpcErr := &Error{}
		if err := json.Unmarshal(plain, rpcErr); err != nil {
			return &attemptError{err: InternalServerError().WithMessage(invalidResponseMessage).WithCause(err)}
		}
		if rpcErr.Status == 0 {
			rpcErr.Status = res.StatusCode
		}
		return &attemptError{err: rpcErr}
	}

	var results []struct {
		ID     string          `json:"id"`
		Status int             `json:"status"`
		Result json.RawMessage `json:"result"`
	}
	if err := json.Unmarshal(envelope["calls"], &results); err != nil {
		return &attemptError{err: InternalServerError().WithMessage(invalidResponseMessage).WithCause(err)}
	}

	byID := make(map[string]int, len(results))
	for i, r := range results {
		byID[r.ID] = i
	}

	for i, call := range calls {
		idx, ok := byID[ids[i]]
		if !ok {
			call.Err = InternalServerError().WithMessage("Call not returned")
			continue
		}
		call.Err = decodeResult(results[idx].Status, results[idx].Result, call.Output)
	}
	return nil
}

func decodeResult(status int, result json.RawMessage, out any) error {
	if status >= 200 && status < 300 {
		if out == nil || len(result) == 0 {
			return nil
		}
		if err := json.Unmarshal(result, out); err != nil {
			return InternalServerError().WithMessage(invalidResponseMessage).WithCause(err)
		}
		return nil
	}

	rpcErr := &Error{}
	if err := json.Unmarshal(result, rpcErr); err != nil {
		return InternalServerError().WithMessage(invalidResponseMessage).WithCause(err)
	}
	if rpcErr.Status == 0 {
		rpcErr.Status = status
	}
	if rpcErr.Status < 400 {
		rpcErr.Status = 500
	}
	return rpcErr
}
