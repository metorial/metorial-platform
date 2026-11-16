package gateway

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"log/slog"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/servicediscovery"
	"github.com/aws/aws-sdk-go-v2/service/servicediscovery/types"
)

type fakeDiscoverer struct {
	ips   []string
	err   error
	calls int
}

func (f *fakeDiscoverer) DiscoverInstances(_ context.Context, in *servicediscovery.DiscoverInstancesInput, _ ...func(*servicediscovery.Options)) (*servicediscovery.DiscoverInstancesOutput, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	if *in.NamespaceName != "metorial.local" || *in.ServiceName != "network-logs" {
		return nil, errors.New("unexpected service")
	}
	out := &servicediscovery.DiscoverInstancesOutput{}
	for _, ip := range f.ips {
		out.Instances = append(out.Instances, types.HttpInstanceSummary{Attributes: map[string]string{"AWS_INSTANCE_IPV4": ip}})
	}
	return out, nil
}

func TestDiscoveryTransportRewritesHost(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(r.URL.Path))
	}))
	t.Cleanup(server.Close)
	host, _, _ := net.SplitHostPort(server.Listener.Addr().String())
	portNumber := server.Listener.Addr().(*net.TCPAddr).Port

	discoverer := &fakeDiscoverer{ips: []string{host}}
	client := &http.Client{Transport: &DiscoveryTransport{
		Discovery: discoverer,
		Namespace: "metorial.local",
		Service:   "network-logs",
		Port:      portNumber,
	}}

	for range 3 {
		response, err := client.Get("http://network-logs.metorial.local:52250/rpc")
		if err != nil {
			t.Fatal(err)
		}
		_ = response.Body.Close()
		if response.StatusCode != http.StatusOK {
			t.Fatalf("status %d", response.StatusCode)
		}
	}
	if discoverer.calls != 1 {
		t.Fatalf("discover calls %d, want cached", discoverer.calls)
	}

	discoverer.ips = nil
	discoverer.err = errors.New("throttled")
	transport := client.Transport.(*DiscoveryTransport)
	transport.fetchedAt = time.Time{}
	if response, err := client.Get("http://network-logs.metorial.local:52250/rpc"); err != nil {
		t.Fatalf("expected the last known instance to be reused: %v", err)
	} else {
		_ = response.Body.Close()
	}
}

func TestDiscoveryTransportFailsWithoutInstances(t *testing.T) {
	client := &http.Client{Transport: &DiscoveryTransport{
		Discovery: &fakeDiscoverer{},
		Namespace: "metorial.local",
		Service:   "network-logs",
		Port:      52250,
	}}
	if _, err := client.Get("http://network-logs.metorial.local:52250/rpc"); err == nil {
		t.Fatal("expected an error")
	}
}

func TestCertReloaderPicksUpRenewedCertificate(t *testing.T) {
	dir := t.TempDir()
	certFile := filepath.Join(dir, "tls.crt")
	keyFile := filepath.Join(dir, "tls.key")

	writeCert(t, certFile, keyFile, "first")
	reloader, err := NewCertReloader(certFile, keyFile)
	if err != nil {
		t.Fatal(err)
	}
	if name := leafName(t, reloader); name != "first" {
		t.Fatalf("leaf %q", name)
	}

	writeCert(t, certFile, keyFile, "second")
	future := time.Now().Add(time.Minute)
	_ = os.Chtimes(certFile, future, future)
	reloader.checkedAt = time.Time{}
	if name := leafName(t, reloader); name != "second" {
		t.Fatalf("leaf after renewal %q", name)
	}
}

func leafName(t *testing.T, reloader *CertReloader) string {
	t.Helper()
	cert, err := reloader.GetCertificate(&tls.ClientHelloInfo{})
	if err != nil {
		t.Fatal(err)
	}
	leaf, err := x509.ParseCertificate(cert.Certificate[0])
	if err != nil {
		t.Fatal(err)
	}
	return leaf.Subject.CommonName
}

func writeCert(t *testing.T, certFile, keyFile, name string) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject:      pkix.Name{CommonName: name},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		DNSNames:     []string{name},
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(certFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyFile, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}), 0o600); err != nil {
		t.Fatal(err)
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}
