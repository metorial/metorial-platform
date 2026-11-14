package main

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/servicediscovery"
	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc/kubeauth"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/internal/gateway"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/internal/healthcheck"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/rpc/networklogsrpc"
)

func main() {
	healthcheck.RunIfRequested(defaultHealthURL(os.Getenv))

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("egress gateway exited", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := loadConfig(os.Getenv)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	var keys egress.Keys = cfg.publicKeys
	if cfg.publicKeysFile != "" {
		fileKeys, err := egress.NewFileKeySet(cfg.publicKeysFile, 10*time.Second)
		if err != nil {
			return fmt.Errorf("EGRESS_GRANT_PUBLIC_KEYS_FILE: %w", err)
		}
		keys = fileKeys
	}

	hardDeny := cfg.hardDeny
	if cfg.denyOwnAddresses {
		own, err := ownAddresses()
		if err != nil {
			return fmt.Errorf("list interface addresses: %w", err)
		}
		hardDeny = append(hardDeny, own...)
	}

	metrics := gateway.NewMetrics()
	recorder := gateway.NewRecorder(newInstanceID(cfg.instanceID), cfg.maxBufferAge, func(n int) {
		metrics.ObservationsDropped.Add(float64(n))
	})

	memory := gateway.NewResolveMemory()
	core := &gateway.Core{
		Keys:        keys,
		Evaluator:   &policy.Evaluator{AllowInternalDestinations: cfg.allowInternalDestinations, HardDeny: hardDeny},
		Resolver:    newResolver(cfg.dnsServers),
		DialTimeout: cfg.dialTimeout,
		Memory:      memory,
		Recorder:    recorder,
		Metrics:     metrics,
		Logger:      logger,
	}

	shipCtx, stopShipping := context.WithCancel(context.Background())
	defer stopShipping()

	var background sync.WaitGroup
	if cfg.logsEnabled() {
		sender, err := newSender(ctx, cfg)
		if err != nil {
			return err
		}
		background.Go(func() { gateway.Ship(shipCtx, recorder, sender, cfg.flushInterval, metrics, logger) })
	} else {
		logger.Warn("NETWORK_LOGS_URL and NETWORK_LOGS_DISCOVERY_* are unset; observations are not shipped")
	}
	background.Go(func() { pruneMemory(ctx, memory) })

	servers, err := newServers(cfg, core, metrics)
	if err != nil {
		return err
	}

	errs := make(chan error, len(servers))
	for _, server := range servers {
		go func() {
			logger.Info("listening", "name", server.name, "addr", server.Addr, "tls", server.TLSConfig != nil)
			var err error
			if server.TLSConfig != nil {
				err = server.ListenAndServeTLS("", "")
			} else {
				err = server.ListenAndServe()
			}
			if err != nil && !errors.Is(err, http.ErrServerClosed) {
				errs <- fmt.Errorf("%s: %w", server.name, err)
			}
		}()
	}

	select {
	case <-ctx.Done():
	case err = <-errs:
		stop()
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	for _, server := range servers {
		_ = server.Shutdown(shutdownCtx)
	}
	stopShipping()
	background.Wait()
	return err
}

type namedServer struct {
	*http.Server
	name string
}

func newServers(cfg *config, core *gateway.Core, metrics *gateway.Metrics) ([]namedServer, error) {
	var servers []namedServer

	if cfg.tunnelAddr != listenerOff {
		server := &http.Server{
			Addr:              cfg.tunnelAddr,
			Handler:           &gateway.TunnelServer{Core: core, IdleTimeout: cfg.idleTimeout},
			ReadHeaderTimeout: 5 * time.Second,
			MaxHeaderBytes:    64 << 10,
			Protocols:         new(http.Protocols),
		}
		if cfg.tls {
			certs, err := gateway.NewCertReloader(cfg.certFile, cfg.keyFile)
			if err != nil {
				return nil, fmt.Errorf("load tunnel certificate: %w", err)
			}
			server.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12, GetCertificate: certs.GetCertificate}
			server.Protocols.SetHTTP2(true)
		} else {
			server.Protocols.SetUnencryptedHTTP2(true)
		}
		server.Protocols.SetHTTP1(true)
		servers = append(servers, namedServer{Server: server, name: "tunnel"})
	}

	if cfg.proxyAddr != listenerOff {
		servers = append(servers, namedServer{name: "proxy", Server: &http.Server{
			Addr:              cfg.proxyAddr,
			Handler:           &gateway.ProxyServer{Core: core, IdleTimeout: cfg.idleTimeout},
			ReadHeaderTimeout: 5 * time.Second,
			IdleTimeout:       90 * time.Second,
			MaxHeaderBytes:    64 << 10,
		}})
	}

	if cfg.metricsAddr != listenerOff {
		mux := http.NewServeMux()
		mux.Handle("GET /metrics", metrics.Handler())
		mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte("ok"))
		})
		servers = append(servers, namedServer{name: "metrics", Server: &http.Server{
			Addr:              cfg.metricsAddr,
			Handler:           mux,
			ReadHeaderTimeout: 5 * time.Second,
		}})
	}

	return servers, nil
}

func newSender(ctx context.Context, cfg *config) (gateway.Sender, error) {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	if cfg.logsCAFile != "" {
		pem, err := os.ReadFile(cfg.logsCAFile)
		if err != nil {
			return nil, fmt.Errorf("NETWORK_LOGS_CA_FILE: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			return nil, errors.New("NETWORK_LOGS_CA_FILE: no certificates found")
		}
		transport.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: pool}
	}

	var roundTripper http.RoundTripper = transport
	if cfg.logsDiscoveryService != "" {
		awsCfg, err := awsconfig.LoadDefaultConfig(ctx)
		if err != nil {
			return nil, fmt.Errorf("load aws config for log store discovery: %w", err)
		}
		roundTripper = &gateway.DiscoveryTransport{
			Base:      transport,
			Discovery: servicediscovery.NewFromConfig(awsCfg),
			Namespace: cfg.logsDiscoveryNS,
			Service:   cfg.logsDiscoveryService,
			Port:      cfg.logsDiscoveryPort,
		}
	}

	options := ldrpc.ClientOptions{
		HTTPClient: &http.Client{Transport: roundTripper},
		HMACToken:  cfg.logsSecret,
		Timeout:    20 * time.Second,
	}
	if cfg.logsTokenFile != "" {
		options.HeaderFunc = kubeauth.TokenFileHeader(cfg.logsTokenFile)
	}

	client, err := networklogsrpc.NewClient(cfg.logsEndpoint(), options)
	if err != nil {
		return nil, fmt.Errorf("network logs client: %w", err)
	}
	return &gateway.RPCSender{Client: client}, nil
}

func newResolver(servers []string) gateway.Resolver {
	if len(servers) == 0 {
		return net.DefaultResolver
	}

	addrs := make([]string, 0, len(servers))
	for _, server := range servers {
		addr, _ := normalizeDNSServer(server)
		addrs = append(addrs, addr)
	}

	var next uint32
	var mu sync.Mutex
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	return &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
			mu.Lock()
			addr := addrs[next%uint32(len(addrs))]
			next++
			mu.Unlock()
			return dialer.DialContext(ctx, network, addr)
		},
	}
}

func ownAddresses() ([]netip.Prefix, error) {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return nil, err
	}

	prefixes := make([]netip.Prefix, 0, len(addrs))
	for _, addr := range addrs {
		ipNet, ok := addr.(*net.IPNet)
		if !ok {
			continue
		}
		ip, ok := netip.AddrFromSlice(ipNet.IP)
		if !ok {
			continue
		}
		ip = ip.Unmap()
		prefixes = append(prefixes, netip.PrefixFrom(ip, ip.BitLen()))
	}
	return prefixes, nil
}

func pruneMemory(ctx context.Context, memory *gateway.ResolveMemory) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			memory.Prune()
		}
	}
}

// The log store discards batch IDs it has already seen, and the batch sequence restarts with
// the process, so the instance ID must be unique per process start, not per pod.
func newInstanceID(prefix string) string {
	if prefix == "" {
		prefix, _ = os.Hostname()
	}
	buf := make([]byte, 6)
	_, _ = rand.Read(buf)
	if prefix == "" {
		return hex.EncodeToString(buf)
	}
	return prefix + "-" + hex.EncodeToString(buf)
}

func defaultHealthURL(getenv func(string) string) string {
	for _, candidate := range []struct{ name, fallback string }{
		{"EGRESS_GATEWAY_METRICS_ADDR", ":9090"},
		{"EGRESS_GATEWAY_PROXY_ADDR", ":8080"},
	} {
		addr := getenv(candidate.name)
		if addr == "" {
			addr = candidate.fallback
		}
		if addr != listenerOff {
			return healthcheck.LocalURL(addr)
		}
	}
	return healthcheck.LocalURL(":9090")
}
