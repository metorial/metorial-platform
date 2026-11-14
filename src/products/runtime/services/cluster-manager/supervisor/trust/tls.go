package trust

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"os"
)

// ClientTLS trusts the CA bundle at caFile when it exists (Kourier TLS mode mounts
// runtime-ca there), the system roots otherwise.
func ClientTLS(serverName, caFile string) (*tls.Config, error) {
	cfg := &tls.Config{ServerName: serverName, MinVersion: tls.VersionTLS12}

	if caFile == "" {
		return cfg, nil
	}
	pem, err := os.ReadFile(caFile)
	if errors.Is(err, os.ErrNotExist) {
		return cfg, nil
	}
	if err != nil {
		return nil, err
	}

	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(pem) {
		return nil, fmt.Errorf("trust: no certificates in %s", caFile)
	}
	cfg.RootCAs = pool
	return cfg, nil
}
