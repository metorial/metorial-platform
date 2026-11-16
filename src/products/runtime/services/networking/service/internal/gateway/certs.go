package gateway

import (
	"crypto/tls"
	"os"
	"sync"
	"time"
)

// CertReloader serves the key pair from disk and reloads it when either file changes,
// so cert-manager renewals apply without a restart.
type CertReloader struct {
	certFile string
	keyFile  string

	mu        sync.Mutex
	cert      *tls.Certificate
	certStamp fileStamp
	keyStamp  fileStamp
	checkedAt time.Time
}

type fileStamp struct {
	modTime time.Time
	size    int64
}

func NewCertReloader(certFile, keyFile string) (*CertReloader, error) {
	reloader := &CertReloader{certFile: certFile, keyFile: keyFile}
	if err := reloader.reload(); err != nil {
		return nil, err
	}
	return reloader, nil
}

func (c *CertReloader) GetCertificate(*tls.ClientHelloInfo) (*tls.Certificate, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if time.Since(c.checkedAt) > 10*time.Second {
		c.checkedAt = time.Now()
		certStamp, certErr := stamp(c.certFile)
		keyStamp, keyErr := stamp(c.keyFile)
		if certErr == nil && keyErr == nil && (certStamp != c.certStamp || keyStamp != c.keyStamp) {
			_ = c.reloadLocked()
		}
	}
	return c.cert, nil
}

func (c *CertReloader) reload() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.reloadLocked()
}

func (c *CertReloader) reloadLocked() error {
	certStamp, err := stamp(c.certFile)
	if err != nil {
		return err
	}
	keyStamp, err := stamp(c.keyFile)
	if err != nil {
		return err
	}
	cert, err := tls.LoadX509KeyPair(c.certFile, c.keyFile)
	if err != nil {
		return err
	}
	c.cert = &cert
	c.certStamp = certStamp
	c.keyStamp = keyStamp
	c.checkedAt = time.Now()
	return nil
}

func stamp(path string) (fileStamp, error) {
	info, err := os.Stat(path)
	if err != nil {
		return fileStamp{}, err
	}
	return fileStamp{modTime: info.ModTime(), size: info.Size()}, nil
}
