package bundle

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/klauspost/compress/zstd"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/trust"
)

const (
	SelfPath            = "/v1/bundles/self"
	maxDecoderMemory    = 512 << 20
	maxTrailingUnpacked = 1 << 20
)

type FetchOptions struct {
	Addr           string
	ServerName     string
	CAFile         string
	TokenFile      string
	ExpectedSize   int64
	ExpectedSHA256 string
	Dir            string
	Limits         Limits
	Timeout        time.Duration
}

type StatusError struct {
	Status int
}

func (e *StatusError) Error() string {
	return fmt.Sprintf("bundle: cluster-manager answered %d", e.Status)
}

type IntegrityError struct {
	Reason string
}

func (e *IntegrityError) Error() string {
	return "bundle: integrity check failed: " + e.Reason
}

// Fetch streams the pod's bundle from the cluster-manager and unpacks it into opts.Dir. The
// archive is unpacked while it downloads; when the size or hash don't match, the directory
// is cleared again before anything could have run from it.
func Fetch(ctx context.Context, opts FetchOptions) (*Stats, error) {
	if opts.ExpectedSize <= 0 || len(opts.ExpectedSHA256) != sha256.Size*2 {
		return nil, errors.New("bundle: expected size and sha256 are required")
	}

	client, err := httpClient(opts)
	if err != nil {
		return nil, err
	}

	token, err := os.ReadFile(opts.TokenFile)
	if err != nil {
		return nil, fmt.Errorf("bundle: read token: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(opts.Addr, "/")+SelfPath, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(string(token)))
	req.Header.Set("Accept", "application/zstd")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
		return nil, &StatusError{Status: resp.StatusCode}
	}

	if err := Clear(opts.Dir); err != nil {
		return nil, err
	}

	stats, err := unpackVerified(resp.Body, opts)
	if err != nil {
		_ = Clear(opts.Dir)
		return nil, err
	}
	return stats, nil
}

func unpackVerified(body io.Reader, opts FetchOptions) (*Stats, error) {
	counter := &countingReader{r: io.LimitReader(body, opts.ExpectedSize+1)}
	hasher := sha256.New()
	compressed := io.TeeReader(counter, hasher)

	decoder, err := zstd.NewReader(compressed, zstd.WithDecoderConcurrency(1), zstd.WithDecoderMaxMemory(maxDecoderMemory))
	if err != nil {
		return nil, err
	}
	defer decoder.Close()

	stats, err := Unpack(decoder, opts.Dir, opts.Limits)
	if err != nil {
		return nil, err
	}

	// The hash covers the whole body, so drain what the tar reader didn't need.
	if _, err := io.CopyN(io.Discard, decoder, maxTrailingUnpacked); err != nil && !errors.Is(err, io.EOF) {
		return nil, fmt.Errorf("bundle: invalid compressed stream: %w", err)
	}
	if _, err := io.Copy(io.Discard, compressed); err != nil {
		return nil, err
	}

	if counter.n != opts.ExpectedSize {
		return nil, &IntegrityError{Reason: fmt.Sprintf("size %d, expected %d", counter.n, opts.ExpectedSize)}
	}
	sum := hex.EncodeToString(hasher.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(sum), []byte(strings.ToLower(opts.ExpectedSHA256))) != 1 {
		return nil, &IntegrityError{Reason: "sha256 mismatch"}
	}
	return stats, nil
}

func httpClient(opts FetchOptions) (*http.Client, error) {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil

	if strings.HasPrefix(opts.Addr, "https://") {
		cfg, err := trust.ClientTLS(opts.ServerName, opts.CAFile)
		if err != nil {
			return nil, err
		}
		transport.TLSClientConfig = cfg
	}

	timeout := opts.Timeout
	if timeout == 0 {
		timeout = 10 * time.Minute
	}
	return &http.Client{Transport: transport, Timeout: timeout}, nil
}

type countingReader struct {
	r io.Reader
	n int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}
