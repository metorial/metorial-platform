package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"time"

	doctor "github.com/metorial/metorial-platform/src/lib/doctor/go"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/internal/gateway"
)

const (
	doctorDocs          = "datacenter/operations/doctor#egress-gateway"
	dnsProbeHost        = "example.com"
	certificateWarnLeft = 14 * 24 * time.Hour
	// Covers the signers' first publish plus the kubelet's ConfigMap volume sync (about a minute).
	grantKeysStartupGrace = 2 * time.Minute
)

func doctorResolution(summary string) *doctor.Resolution {
	link := doctorDocs
	return &doctor.Resolution{Summary: summary, Docs: &link}
}

func newDoctor(cfg *config, resolver gateway.Resolver, getenv func(string) string) (*doctor.Doctor, error) {
	d := doctor.New(doctor.Options{Component: "egress-gateway"})
	err := d.Register(
		grantKeysCheck(cfg, time.Now(), time.Now),
		dnsCheck(cfg, resolver),
		certificateCheck(cfg),
		networkLogsCheck(cfg),
		internetCheck(getenv("EGRESS_DOCTOR_PROBE_URL")),
	)
	if err != nil {
		return nil, err
	}

	return d, nil
}

func grantKeysCheck(cfg *config, startedAt time.Time, now func() time.Time) doctor.Check {
	return doctor.Check{
		ID:       "config.grant-keys",
		Title:    "Grant public keys are loaded",
		Category: doctor.CategorySecurity,
		Severity: doctor.SeverityCritical,
		Run: func(_ context.Context, r *doctor.Result) error {
			keys := cfg.publicKeys
			source := "EGRESS_GRANT_PUBLIC_KEYS"
			publishedResolution := doctorResolution(
				"The functions and build services publish their keys to the egress-trust ConfigMap; check their trust-key doctor checks.",
			)

			// The key file is written by the signers after they start, so on a fresh install or
			// rollout it shows up a minute or so after the gateway does.
			fail := func(message string, details map[string]any) {
				if cfg.publicKeysFile != "" && now().Sub(startedAt) < grantKeysStartupGrace {
					r.Warn(message+" The gateway started recently; the keys usually appear within a minute.", publishedResolution, details)
					return
				}
				r.Fail(message, publishedResolution, details)
			}

			if cfg.publicKeysFile != "" {
				source = cfg.publicKeysFile
				raw, err := os.ReadFile(cfg.publicKeysFile)
				if errors.Is(err, os.ErrNotExist) {
					fail("The grant key file does not exist yet, so every connection is refused.", map[string]any{"source": source})
					return nil
				}
				if err != nil {
					return err
				}
				if keys, err = egress.ParseKeySet(raw); err != nil {
					r.Fail("The grant key file does not parse: "+err.Error(), publishedResolution, map[string]any{"source": source})
					return nil
				}
			}

			if keys.Len() == 0 {
				if cfg.publicKeysFile == "" {
					r.Fail("No grant public keys are loaded, so every connection is refused.", doctorResolution(
						"Set EGRESS_GRANT_PUBLIC_KEYS to the public keys of the functions and build signing keys.",
					), map[string]any{"source": source})
					return nil
				}
				fail("No grant public keys are loaded, so every connection is refused.", map[string]any{"source": source})
				return nil
			}

			r.Pass(fmt.Sprintf("%d grant public keys are loaded.", keys.Len()), map[string]any{"source": source, "keys": keys.Len()})
			return nil
		},
	}
}

// Without grant keys every connection is refused, so the gateway stays out of its Service until the
// signers have published them, instead of accepting connections it can only reject.
func grantKeysReady(cfg *config) error {
	if cfg.publicKeysFile == "" {
		if cfg.publicKeys == nil || cfg.publicKeys.Len() == 0 {
			return errors.New("no grant public keys are configured")
		}
		return nil
	}

	raw, err := os.ReadFile(cfg.publicKeysFile)
	if err != nil {
		return fmt.Errorf("grant key file not loaded yet: %w", err)
	}
	keys, err := egress.ParseKeySet(raw)
	if err != nil {
		return fmt.Errorf("grant key file does not parse: %w", err)
	}
	if keys.Len() == 0 {
		return errors.New("grant key file has no keys yet")
	}
	return nil
}

func dnsCheck(cfg *config, resolver gateway.Resolver) doctor.Check {
	return doctor.Check{
		ID:       "dns.resolvers",
		Title:    "The egress DNS servers answer",
		Category: doctor.CategoryExternal,
		Severity: doctor.SeverityCritical,
		Target:   "dns",
		Run: func(ctx context.Context, r *doctor.Result) error {
			if len(cfg.dnsServers) == 0 {
				r.Skip("EGRESS_DNS_SERVERS is not set; the cluster resolver is used.", nil)
				return nil
			}

			started := time.Now()
			_, err := resolver.LookupNetIP(ctx, "ip", dnsProbeHost)
			details := map[string]any{"servers": cfg.dnsServers, "latencyMs": time.Since(started).Milliseconds()}

			// An NXDOMAIN answer still shows the servers respond.
			var dnsErr *net.DNSError
			if err == nil || (errors.As(err, &dnsErr) && dnsErr.IsNotFound) {
				r.Pass("The DNS servers answer.", details)
				return nil
			}

			r.Fail("The DNS servers did not answer: "+doctor.DescribeError(err).Message, doctorResolution(
				"Check EGRESS_DNS_SERVERS and that the gateway may reach them on port 53.",
			), details)
			return nil
		},
	}
}

func certificateCheck(cfg *config) doctor.Check {
	return doctor.Check{
		ID:       "tls.certificate",
		Title:    "The tunnel certificate is valid",
		Category: doctor.CategorySecurity,
		Severity: doctor.SeverityCritical,
		Run: func(_ context.Context, r *doctor.Result) error {
			if !cfg.tls || cfg.tunnelAddr == listenerOff {
				r.Skip("The tunnel listener does not use TLS.", nil)
				return nil
			}

			pair, err := tls.LoadX509KeyPair(cfg.certFile, cfg.keyFile)
			if err != nil {
				r.Fail("The certificate cannot be loaded: "+err.Error(), doctorResolution(
					"Check EGRESS_GATEWAY_TLS_CERT_FILE and EGRESS_GATEWAY_TLS_KEY_FILE.",
				), nil)
				return nil
			}

			leaf, err := x509.ParseCertificate(pair.Certificate[0])
			if err != nil {
				return err
			}

			left := time.Until(leaf.NotAfter)
			details := map[string]any{"notAfter": leaf.NotAfter.UTC().Format(time.RFC3339), "subject": leaf.Subject.String()}
			renew := doctorResolution("Renew the egress gateway certificate (cert-manager or the chart's generated certificate).")
			switch {
			case left <= 0:
				r.Fail("The certificate expired on "+leaf.NotAfter.UTC().Format(time.DateOnly)+".", renew, details)
			case left < certificateWarnLeft:
				r.Warn(fmt.Sprintf("The certificate expires in %d days.", int(left.Hours()/24)), renew, details)
			default:
				r.Pass(fmt.Sprintf("The certificate is valid for %d more days.", int(left.Hours()/24)), details)
			}
			return nil
		},
	}
}

func networkLogsCheck(cfg *config) doctor.Check {
	return doctor.Check{
		ID:       "dependencies.network-logs",
		Title:    "network-logs is reachable",
		Category: doctor.CategoryDependency,
		Severity: doctor.SeverityWarning,
		Target:   "network-logs",
		Run: func(ctx context.Context, r *doctor.Result) error {
			if !cfg.logsEnabled() {
				r.Warn("No network-logs endpoint is configured, so observations are not shipped.", doctorResolution(
					"Set NETWORK_LOGS_URL.",
				), nil)
				return nil
			}
			if cfg.logsURL == "" {
				r.Skip("network-logs is discovered through Cloud Map.", nil)
				return nil
			}

			address, err := hostPort(cfg.logsURL)
			if err != nil {
				return err
			}
			return doctor.TCPProbe(address)(ctx, r)
		},
	}
}

func internetCheck(probeURL string) doctor.Check {
	return doctor.Check{
		ID:       "egress.internet",
		Title:    "The gateway reaches the internet",
		Category: doctor.CategoryExternal,
		Severity: doctor.SeverityWarning,
		Timeout:  10 * time.Second,
		Run: func(ctx context.Context, r *doctor.Result) error {
			if probeURL == "" {
				r.Skip("EGRESS_DOCTOR_PROBE_URL is not set.", nil)
				return nil
			}

			client := &http.Client{Transport: &http.Transport{Proxy: nil}}
			return doctor.Probe("The probe URL", doctor.HTTPCall(client, probeURL), 2*time.Second)(ctx, r)
		},
	}
}

func hostPort(raw string) (string, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", err
	}

	port := parsed.Port()
	if port == "" {
		port = map[string]string{"https": "443", "http": "80"}[parsed.Scheme]
	}
	if parsed.Hostname() == "" || port == "" {
		return "", fmt.Errorf("cannot derive an address from %q", raw)
	}
	return net.JoinHostPort(parsed.Hostname(), port), nil
}
