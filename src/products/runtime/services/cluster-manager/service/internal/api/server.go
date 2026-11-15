package api

import (
	"context"
	"crypto/tls"
	"errors"
	"net"
	"net/http"
	"os"
	"sync"
	"time"
)

const shutdownGrace = 30 * time.Second

// Serve runs an HTTP server until ctx is cancelled. With certificate files it serves TLS and
// reloads the pair whenever the files change, so cert-manager renewals need no restart.
func Serve(ctx context.Context, addr string, handler http.Handler, certFile, keyFile string) error {
	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
		BaseContext:       func(net.Listener) context.Context { return ctx },
	}

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	if certFile != "" {
		reloader := &certReloader{certFile: certFile, keyFile: keyFile}
		if _, err := reloader.get(nil); err != nil {
			return err
		}
		ln = tls.NewListener(ln, &tls.Config{MinVersion: tls.VersionTLS12, GetCertificate: reloader.get, NextProtos: []string{"h2", "http/1.1"}})
	}

	errCh := make(chan error, 1)
	go func() { errCh <- srv.Serve(ln) }()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownGrace)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

type certReloader struct {
	certFile string
	keyFile  string

	mu      sync.Mutex
	cert    *tls.Certificate
	modTime time.Time
}

func (c *certReloader) get(*tls.ClientHelloInfo) (*tls.Certificate, error) {
	certInfo, err := os.Stat(c.certFile)
	if err != nil {
		return c.cached(err)
	}
	keyInfo, err := os.Stat(c.keyFile)
	if err != nil {
		return c.cached(err)
	}
	modTime := certInfo.ModTime()
	if keyInfo.ModTime().After(modTime) {
		modTime = keyInfo.ModTime()
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	if c.cert != nil && modTime.Equal(c.modTime) {
		return c.cert, nil
	}

	cert, err := tls.LoadX509KeyPair(c.certFile, c.keyFile)
	if err != nil {
		if c.cert != nil {
			return c.cert, nil
		}
		return nil, err
	}
	c.cert, c.modTime = &cert, modTime
	return c.cert, nil
}

func (c *certReloader) cached(err error) (*tls.Certificate, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.cert != nil {
		return c.cert, nil
	}
	return nil, err
}
