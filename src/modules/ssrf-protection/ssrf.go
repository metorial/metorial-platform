package ssrfProtection

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"
)

func CreateSecureHTTPClient() *http.Client {
	dialer := &net.Dialer{
		Timeout:   10 * time.Second,
		KeepAlive: 10 * time.Second,
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			// Parse the address to get host and port
			host, port, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, fmt.Errorf("failed to parse address %s: %w", addr, err)
			}

			// Resolve the host to IPs
			ips, err := net.LookupIP(host)
			if err != nil {
				return nil, fmt.Errorf("failed to resolve %s: %w", host, err)
			}

			// Validate all resolved IPs
			for _, ip := range ips {
				err := validateIP(ip)
				if err != nil {
					return nil, fmt.Errorf("connection blocked: %w", err)
				}
			}

			// Validate port
			err = validatePort(port)
			if err != nil {
				return nil, fmt.Errorf("connection blocked: %w", err)
			}

			// If all validations pass, proceed with the connection
			return dialer.DialContext(ctx, network, addr)
		},
		MaxIdleConns:          256,
		IdleConnTimeout:       30 * time.Second,
		DisableCompression:    false,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
	}

	return &http.Client{
		Transport: transport,
		Timeout:   30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// Limit redirect chain length
			if len(via) >= 3 {
				return fmt.Errorf("too many redirects")
			}

			// Validate each redirect URL
			err := ValidateURL(req.URL.String())
			if err != nil {
				return fmt.Errorf("redirect blocked: %w", err)
			}

			return nil
		},
	}
}
