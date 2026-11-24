package doctor

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"time"
)

const (
	DefaultHTTPWarnLatency = time.Second
	DefaultTCPWarnLatency  = 250 * time.Millisecond
	DefaultCertWarnBefore  = 14 * 24 * time.Hour
)

type HTTPStatusError struct {
	StatusCode int
	URL        string
}

func (e *HTTPStatusError) Error() string {
	return fmt.Sprintf("%s responded with HTTP %d", e.URL, e.StatusCode)
}

func (e *HTTPStatusError) HTTPStatusCode() int {
	return e.StatusCode
}

// Probe turns a plain call into a check body that passes or warns depending on its latency.
func Probe(label string, call func(ctx context.Context) error, warnLatency time.Duration) func(context.Context, *Result) error {
	return func(ctx context.Context, r *Result) error {
		started := time.Now()
		if err := call(ctx); err != nil {
			return err
		}

		latency := time.Since(started).Round(time.Millisecond)
		latencyMs := latency.Milliseconds()

		if warnLatency > 0 && latency > warnLatency {
			r.Warn(
				fmt.Sprintf("%s answered in %dms, slower than %dms.", label, latencyMs, warnLatency.Milliseconds()),
				nil,
				map[string]any{"latencyMs": latencyMs, "thresholdMs": warnLatency.Milliseconds()},
			)
			return nil
		}

		r.Pass(fmt.Sprintf("%s answered in %dms.", label, latencyMs), map[string]any{"latencyMs": latencyMs})
		return nil
	}
}

func HTTPCall(client *http.Client, url string) func(ctx context.Context) error {
	if client == nil {
		client = http.DefaultClient
	}

	return func(ctx context.Context) error {
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return err
		}

		response, err := client.Do(request)
		if err != nil {
			return err
		}
		defer response.Body.Close()
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 64<<10))

		if response.StatusCode >= 400 {
			return &HTTPStatusError{StatusCode: response.StatusCode, URL: url}
		}
		return nil
	}
}

func TCPCall(address string) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		var dialer net.Dialer
		connection, err := dialer.DialContext(ctx, "tcp", address)
		if err != nil {
			return err
		}
		return connection.Close()
	}
}

func DNSCall(host string) func(ctx context.Context) error {
	return func(ctx context.Context) error {
		_, err := net.DefaultResolver.LookupHost(ctx, host)
		return err
	}
}

func HTTPProbe(client *http.Client, url string) func(context.Context, *Result) error {
	return Probe("HTTP endpoint", HTTPCall(client, url), DefaultHTTPWarnLatency)
}

func TCPProbe(address string) func(context.Context, *Result) error {
	return Probe("TCP endpoint", TCPCall(address), DefaultTCPWarnLatency)
}

func DNSProbe(host string) func(context.Context, *Result) error {
	return Probe("DNS", DNSCall(host), 0)
}

// TLSCertificateProbe verifies the certificate presented at host:port and warns when it expires
// within warnBefore. A zero warnBefore uses DefaultCertWarnBefore.
func TLSCertificateProbe(host string, port int, config *tls.Config, warnBefore time.Duration) func(context.Context, *Result) error {
	if port == 0 {
		port = 443
	}
	if warnBefore <= 0 {
		warnBefore = DefaultCertWarnBefore
	}

	return func(ctx context.Context, r *Result) error {
		tlsConfig := &tls.Config{}
		if config != nil {
			tlsConfig = config.Clone()
		}
		if tlsConfig.ServerName == "" {
			tlsConfig.ServerName = host
		}

		dialer := tls.Dialer{Config: tlsConfig}
		address := net.JoinHostPort(host, strconv.Itoa(port))
		connection, err := dialer.DialContext(ctx, "tcp", address)
		if err != nil {
			return err
		}
		defer connection.Close()

		certificates := connection.(*tls.Conn).ConnectionState().PeerCertificates
		if len(certificates) == 0 {
			r.Fail(fmt.Sprintf("%s presented no certificate.", address), nil, nil)
			return nil
		}

		leaf := certificates[0]
		daysLeft := int(time.Until(leaf.NotAfter).Hours() / 24)
		details := map[string]any{
			"host":     host,
			"port":     port,
			"subject":  leaf.Subject.CommonName,
			"issuer":   leaf.Issuer.CommonName,
			"validTo":  formatTime(leaf.NotAfter),
			"daysLeft": daysLeft,
		}

		if time.Until(leaf.NotAfter) < warnBefore {
			r.Warn(fmt.Sprintf("The certificate of %s expires in %d days.", address, daysLeft), nil, details)
			return nil
		}

		r.Pass(fmt.Sprintf("The certificate of %s is valid for %d more days.", address, daysLeft), details)
		return nil
	}
}
