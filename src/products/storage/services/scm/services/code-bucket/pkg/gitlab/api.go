package gitlab

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

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
)

const (
	maxAPIResponseBytes = 32 << 20
	maxAPIErrorBytes    = 2048
	maxReadAttempts     = 4
)

// apiClient is the GitLab REST client manifest exports use. Unlike the legacy
// exporter it doesn't sleep through rate limits: 429s surface as
// *commitbatch.RateLimitedError so the batcher (or Origin) decides when to resume.
type apiClient struct {
	http      *http.Client
	baseURL   *url.URL
	projectID int64
	token     string
	now       func() time.Time
	sleep     func(ctx context.Context, d time.Duration) error
	requests  atomic.Uint32
}

// APIError is a non-2xx GitLab API response.
type APIError struct {
	Op         string
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("GitLab %s returned status %d: %s", e.Op, e.StatusCode, e.Body)
}

func (c *apiClient) projectURL(suffix string) string {
	return fmt.Sprintf("%s/projects/%d%s", strings.TrimSuffix(c.baseURL.String(), "/"), c.projectID, suffix)
}

// do sends one request. A non-nil out is decoded from a 2xx JSON body.
func (c *apiClient) do(ctx context.Context, op, method, rawURL string, body []byte, out any) (http.Header, error) {
	target, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}
	if target.Host != c.baseURL.Host || target.Scheme != c.baseURL.Scheme {
		return nil, fmt.Errorf("GitLab %s: refusing to send credentials to %s", op, target.Host)
	}

	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, target.String(), reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	c.requests.Add(1)
	resp, err := c.http.Do(req)
	if err != nil {
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			err = urlErr.Err
		}
		return nil, fmt.Errorf("GitLab %s: %w", op, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, maxAPIErrorBytes))
		apiErr := &APIError{Op: op, StatusCode: resp.StatusCode, Body: strings.TrimSpace(string(data))}
		if resp.StatusCode == http.StatusTooManyRequests {
			return resp.Header, &commitbatch.RateLimitedError{RetryAfter: gitremote.RetryAfter(resp.Header, c.now()), Err: apiErr}
		}
		return resp.Header, apiErr
	}

	if out == nil {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, maxAPIResponseBytes))
		return resp.Header, nil
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxAPIResponseBytes+1))
	if err != nil {
		return nil, fmt.Errorf("GitLab %s: %w", op, err)
	}
	if len(data) > maxAPIResponseBytes {
		return nil, fmt.Errorf("GitLab %s: response is larger than %d bytes", op, maxAPIResponseBytes)
	}
	if err := json.Unmarshal(data, out); err != nil {
		return nil, fmt.Errorf("GitLab %s: invalid response: %w", op, err)
	}
	return resp.Header, nil
}

// get retries reads on 5xx and transport errors; rate limits are returned.
func (c *apiClient) get(ctx context.Context, op, rawURL string, out any) (http.Header, error) {
	var lastErr error
	for attempt := 1; attempt <= maxReadAttempts; attempt++ {
		header, err := c.do(ctx, op, http.MethodGet, rawURL, nil, out)
		if err == nil || !retryableRead(err) || ctx.Err() != nil {
			return header, err
		}
		lastErr = err
		if attempt < maxReadAttempts {
			if err := c.sleep(ctx, time.Duration(attempt)*time.Second); err != nil {
				return nil, err
			}
		}
	}
	return nil, lastErr
}

func retryableRead(err error) bool {
	var apiErr *APIError
	var rateLimited *commitbatch.RateLimitedError
	switch {
	case errors.As(err, &rateLimited):
		return false
	case errors.As(err, &apiErr):
		return apiErr.StatusCode >= 500
	}
	return true
}

type projectInfo struct {
	HTTPURLToRepo string `json:"http_url_to_repo"`
	DefaultBranch string `json:"default_branch"`
}

func (c *apiClient) project(ctx context.Context) (*projectInfo, error) {
	var project projectInfo
	if _, err := c.get(ctx, "project", c.projectURL(""), &project); err != nil {
		return nil, err
	}
	return &project, nil
}

type branchInfo struct {
	Commit struct {
		ID string `json:"id"`
	} `json:"commit"`
}

func (c *apiClient) branchHead(ctx context.Context, branch string) (string, error) {
	var info branchInfo
	_, err := c.get(ctx, "branch", c.projectURL("/repository/branches/"+url.PathEscape(branch)), &info)
	var apiErr *APIError
	if errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusNotFound {
		return "", commitbatch.ErrBranchMissing
	}
	if err != nil {
		return "", err
	}
	if info.Commit.ID == "" {
		return "", errors.New("GitLab branch response has no commit")
	}
	return info.Commit.ID, nil
}

func (c *apiClient) rawBlob(ctx context.Context, sha string, maxBytes int64) ([]byte, error) {
	target := c.projectURL("/repository/blobs/" + url.PathEscape(sha) + "/raw")
	for attempt := 1; ; attempt++ {
		data, err := c.rawBlobOnce(ctx, target, maxBytes)
		if err == nil || !retryableRead(err) || attempt >= maxReadAttempts || ctx.Err() != nil {
			return data, err
		}
		if err := c.sleep(ctx, time.Duration(attempt)*time.Second); err != nil {
			return nil, err
		}
	}
}

func (c *apiClient) rawBlobOnce(ctx context.Context, target string, maxBytes int64) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	c.requests.Add(1)
	resp, err := c.http.Do(req)
	if err != nil {
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			err = urlErr.Err
		}
		return nil, fmt.Errorf("GitLab blob: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, maxAPIErrorBytes))
		apiErr := &APIError{Op: "blob", StatusCode: resp.StatusCode, Body: strings.TrimSpace(string(data))}
		if resp.StatusCode == http.StatusTooManyRequests {
			return nil, &commitbatch.RateLimitedError{RetryAfter: gitremote.RetryAfter(resp.Header, c.now()), Err: apiErr}
		}
		return nil, apiErr
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("GitLab blob is larger than %d bytes", maxBytes)
	}
	return data, nil
}
