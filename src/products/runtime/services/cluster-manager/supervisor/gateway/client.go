// Package gateway is the supervisor's client for the egress gateway's tunnel front end
// (contracts section 4): one HTTP/2 CONNECT stream per tunnel, plus /v1/resolve.
package gateway

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"

	"golang.org/x/net/http2"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/trust"
)

const (
	GrantHeader  = "metorial-egress-grant"
	ReasonHeader = "metorial-egress-reason"

	dialTimeout    = 30 * time.Second
	resolveTimeout = 15 * time.Second
)

type Client struct {
	addr      string
	scheme    string
	transport *http2.Transport
	http      *http.Client
}

// New connects over TLS when serverName is set and over h2c (prior knowledge) otherwise.
func New(addr, serverName, caFile string) (*Client, error) {
	transport := &http2.Transport{
		ReadIdleTimeout: 30 * time.Second,
		PingTimeout:     10 * time.Second,
	}
	scheme := "https"

	if serverName == "" {
		scheme = "http"
		transport.AllowHTTP = true
		transport.DialTLSContext = func(ctx context.Context, network, addr string, _ *tls.Config) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, network, addr)
		}
	} else {
		cfg, err := trust.ClientTLS(serverName, caFile)
		if err != nil {
			return nil, err
		}
		transport.TLSClientConfig = cfg
	}

	return &Client{
		addr:      addr,
		scheme:    scheme,
		transport: transport,
		http:      &http.Client{Transport: transport},
	}, nil
}

func (c *Client) Close() {
	c.transport.CloseIdleConnections()
}

type DialError struct {
	Status int
	Reason string
	Err    error
}

func (e *DialError) Error() string {
	switch {
	case e.Err != nil:
		return "egress gateway unavailable: " + e.Err.Error()
	case e.Reason != "":
		return fmt.Sprintf("egress gateway answered %d (%s)", e.Status, e.Reason)
	default:
		return fmt.Sprintf("egress gateway answered %d", e.Status)
	}
}

// Tunnel is one CONNECT stream. Closing the write side ends the request stream, so the
// gateway sees a half-close.
type Tunnel struct {
	body   io.ReadCloser
	writer *io.PipeWriter
	cancel context.CancelFunc
	once   sync.Once
}

func (t *Tunnel) Read(p []byte) (int, error) {
	return t.body.Read(p)
}

func (t *Tunnel) Write(p []byte) (int, error) {
	return t.writer.Write(p)
}

func (t *Tunnel) CloseWrite() error {
	return t.writer.Close()
}

func (t *Tunnel) Close() error {
	t.once.Do(func() {
		t.cancel()
		_ = t.writer.CloseWithError(io.ErrClosedPipe)
		_ = t.body.Close()
	})
	return nil
}

// Dial opens a tunnel that lives until ctx is done or Close is called.
func (c *Client) Dial(ctx context.Context, grant, host string, port int) (*Tunnel, error) {
	ctx, cancel := context.WithCancel(ctx)
	timer := time.AfterFunc(dialTimeout, cancel)

	reader, writer := io.Pipe()
	req := &http.Request{
		Method: http.MethodConnect,
		URL:    &url.URL{Scheme: c.scheme, Host: c.addr},
		Host:   net.JoinHostPort(host, strconv.Itoa(port)),
		Header: http.Header{GrantHeader: {grant}},
		Body:   reader,
	}
	req = req.WithContext(ctx)

	resp, err := c.transport.RoundTrip(req)
	timer.Stop()
	if err != nil {
		cancel()
		_ = writer.CloseWithError(err)
		return nil, &DialError{Err: err}
	}

	if resp.StatusCode != http.StatusOK {
		_ = resp.Body.Close()
		cancel()
		_ = writer.Close()
		return nil, &DialError{Status: resp.StatusCode, Reason: resp.Header.Get(ReasonHeader)}
	}

	return &Tunnel{body: resp.Body, writer: writer, cancel: cancel}, nil
}

func (c *Client) Resolve(ctx context.Context, grant, host string) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, resolveTimeout)
	defer cancel()

	u := url.URL{Scheme: c.scheme, Host: c.addr, Path: "/v1/resolve", RawQuery: url.Values{"host": {host}}.Encode()}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set(GrantHeader, grant)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, &DialError{Err: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, &DialError{Status: resp.StatusCode, Reason: resp.Header.Get(ReasonHeader)}
	}

	var body struct {
		Addresses []string `json:"addresses"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&body); err != nil {
		return nil, fmt.Errorf("egress gateway: invalid resolve response: %w", err)
	}
	return body.Addresses, nil
}
