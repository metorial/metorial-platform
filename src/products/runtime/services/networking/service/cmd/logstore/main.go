package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/metorial/metorial-platform/src/lib/rpc/go/kubeauth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/internal/healthcheck"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/internal/logstore"
)

const (
	listenerOff             = "off"
	defaultKubeAudience     = "metorial-network-logs"
	defaultGatewayAccount   = "metorial-egress-gateway"
	defaultFunctionsAccount = "metorial-functions"
	inClusterNamespaceFile  = "/var/run/secrets/kubernetes.io/serviceaccount/namespace"
	defaultRetention        = 7 * 24 * time.Hour
	defaultCleanupInterval  = time.Hour
	shutdownTimeout         = 20 * time.Second
	cleanupStatementTimeout = 5 * time.Minute
	defaultRPCAddr          = ":52250"
	defaultLegacyIngestAddr = ":52210"
	defaultLegacyQueryAddr  = ":52211"
	defaultDatabaseSSLMode  = "require"
	authModeHMAC            = "hmac"
	authModeKube            = "kubeauth"
)

func main() {
	healthcheck.RunIfRequested(healthcheck.LocalURL(envOr(os.Getenv, "NETWORK_LOGS_RPC_ADDR", defaultRPCAddr)))

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("network log store exited", "error", err)
		os.Exit(1)
	}
}

type config struct {
	database         logstore.Config
	rpcAddr          string
	legacyIngestAddr string
	legacyQueryAddr  string
	retention        time.Duration
	cleanupInterval  time.Duration

	authMode       string
	hmacSecret     string
	kubeAudience   string
	ingestAccounts []string
	listAccounts   []string
}

func loadConfig(getenv func(string) string) (*config, error) {
	cfg := &config{
		database: logstore.Config{
			Host:     getenv("DATABASE_HOST"),
			Port:     getenv("DATABASE_PORT"),
			Name:     getenv("DATABASE_NAME"),
			Username: getenv("DATABASE_USERNAME"),
			Password: getenv("DATABASE_PASSWORD"),
			SSLMode:  envOr(getenv, "DATABASE_SSLMODE", defaultDatabaseSSLMode),
		},
		rpcAddr:          envOr(getenv, "NETWORK_LOGS_RPC_ADDR", defaultRPCAddr),
		legacyIngestAddr: envOr(getenv, "OBSERVER_INGEST_ADDR", defaultLegacyIngestAddr),
		legacyQueryAddr:  envOr(getenv, "OBSERVER_QUERY_ADDR", defaultLegacyQueryAddr),
		authMode:         getenv("NETWORK_LOGS_AUTH"),
		hmacSecret:       getenv("NETWORK_LOGS_RPC_SECRET"),
		kubeAudience:     envOr(getenv, "NETWORK_LOGS_KUBEAUTH_AUDIENCE", defaultKubeAudience),
		ingestAccounts:   splitList(getenv("NETWORK_LOGS_INGEST_SERVICE_ACCOUNTS")),
		listAccounts:     splitList(getenv("NETWORK_LOGS_LIST_SERVICE_ACCOUNTS")),
	}

	var err error
	if cfg.retention, err = durationEnv(getenv, time.Hour, defaultRetention, "NETWORK_LOGS_RETENTION_HOURS", "OBSERVER_RETENTION_HOURS"); err != nil {
		return nil, err
	}
	if cfg.cleanupInterval, err = durationEnv(getenv, time.Second, defaultCleanupInterval, "NETWORK_LOGS_CLEANUP_INTERVAL_SECONDS", "OBSERVER_CLEANUP_INTERVAL_SECONDS"); err != nil {
		return nil, err
	}

	if cfg.database.Host == "" || cfg.database.Port == "" || cfg.database.Name == "" || cfg.database.Username == "" {
		return nil, errors.New("DATABASE_HOST, DATABASE_PORT, DATABASE_NAME and DATABASE_USERNAME are required")
	}

	if cfg.authMode == "" {
		cfg.authMode = authModeHMAC
	}
	switch cfg.authMode {
	case authModeHMAC:
		if cfg.rpcAddr != listenerOff && cfg.hmacSecret == "" {
			return nil, errors.New("NETWORK_LOGS_RPC_SECRET is required with NETWORK_LOGS_AUTH=hmac")
		}
	case authModeKube:
		if cfg.hmacSecret != "" {
			return nil, errors.New("NETWORK_LOGS_RPC_SECRET must not be set with NETWORK_LOGS_AUTH=kubeauth")
		}
		if len(cfg.ingestAccounts) == 0 || len(cfg.listAccounts) == 0 {
			namespace := getenv("POD_NAMESPACE")
			if namespace == "" {
				raw, err := os.ReadFile(inClusterNamespaceFile)
				if err != nil {
					return nil, errors.New("set POD_NAMESPACE or NETWORK_LOGS_{INGEST,LIST}_SERVICE_ACCOUNTS")
				}
				namespace = strings.TrimSpace(string(raw))
			}
			if len(cfg.ingestAccounts) == 0 {
				cfg.ingestAccounts = []string{namespace + "/" + defaultGatewayAccount}
			}
			if len(cfg.listAccounts) == 0 {
				cfg.listAccounts = []string{namespace + "/" + defaultFunctionsAccount}
			}
		}
	default:
		return nil, fmt.Errorf("NETWORK_LOGS_AUTH must be %q or %q", authModeHMAC, authModeKube)
	}

	if cfg.rpcAddr == listenerOff && cfg.legacyIngestAddr == listenerOff && cfg.legacyQueryAddr == listenerOff {
		return nil, errors.New("every listener is disabled")
	}
	return cfg, nil
}

func (c *config) auth() (logstore.Auth, error) {
	if c.authMode == authModeHMAC {
		return logstore.Auth{HMACSecret: c.hmacSecret}, nil
	}

	ingest, err := kubeauth.ParseAllowlist(c.ingestAccounts...)
	if err != nil {
		return logstore.Auth{}, fmt.Errorf("NETWORK_LOGS_INGEST_SERVICE_ACCOUNTS: %w", err)
	}
	list, err := kubeauth.ParseAllowlist(c.listAccounts...)
	if err != nil {
		return logstore.Auth{}, fmt.Errorf("NETWORK_LOGS_LIST_SERVICE_ACCOUNTS: %w", err)
	}
	verifier, err := kubeauth.New(kubeauth.Config{
		Audiences: []string{c.kubeAudience},
		Allowed:   append(append(kubeauth.Allowlist{}, ingest...), list...),
	})
	if err != nil {
		return logstore.Auth{}, err
	}
	return logstore.Auth{Kube: verifier, IngestAccounts: ingest, ListAccounts: list}, nil
}

func run(logger *slog.Logger) error {
	cfg, err := loadConfig(os.Getenv)
	if err != nil {
		return err
	}
	auth, err := cfg.auth()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	openCtx, cancelOpen := context.WithTimeout(ctx, 10*time.Minute)
	store, err := logstore.Open(openCtx, cfg.database)
	cancelOpen()
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer store.Close()

	var servers []*http.Server
	add := func(addr string, handler http.Handler) {
		if addr != listenerOff {
			servers = append(servers, &http.Server{Addr: addr, Handler: handler, ReadHeaderTimeout: 5 * time.Second})
		}
	}

	rpcHandler, err := logstore.RPCHandler(&logstore.Service{Store: store, Logger: logger}, auth, logger)
	if err != nil {
		return err
	}
	add(cfg.rpcAddr, rpcHandler)
	add(cfg.legacyIngestAddr, logstore.LegacyIngestHandler(store, logger))
	add(cfg.legacyQueryAddr, logstore.LegacyQueryHandler(store, logger))

	var background sync.WaitGroup
	background.Go(func() { cleanupLoop(ctx, store, cfg.retention, cfg.cleanupInterval, logger) })

	errs := make(chan error, len(servers))
	for _, server := range servers {
		go func() {
			logger.Info("listening", "addr", server.Addr)
			if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				errs <- err
			}
		}()
	}

	select {
	case <-ctx.Done():
	case err = <-errs:
		stop()
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	for _, server := range servers {
		_ = server.Shutdown(shutdownCtx)
	}
	background.Wait()
	return err
}

func cleanupLoop(ctx context.Context, store *logstore.Store, retention, interval time.Duration, logger *slog.Logger) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		cutoff := time.Now().UTC().Add(-retention)
		cleanupCtx, cancel := context.WithTimeout(ctx, cleanupStatementTimeout)
		deleted, err := store.CleanupBefore(cleanupCtx, cutoff)
		cancel()
		if err != nil && ctx.Err() == nil {
			logger.Warn("cleanup failed", "error", err)
		} else if deleted > 0 {
			logger.Info("cleanup deleted old observations", "count", deleted, "cutoff", cutoff.Format(time.RFC3339))
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func envOr(getenv func(string) string, name, fallback string) string {
	if value := getenv(name); value != "" {
		return value
	}
	return fallback
}

func durationEnv(getenv func(string) string, unit, fallback time.Duration, names ...string) (time.Duration, error) {
	for _, name := range names {
		raw := getenv(name)
		if raw == "" {
			continue
		}
		value, err := strconv.Atoi(raw)
		if err != nil || value <= 0 {
			return 0, fmt.Errorf("%s must be a positive integer", name)
		}
		return time.Duration(value) * unit, nil
	}
	return fallback, nil
}

func splitList(raw string) []string {
	return strings.FieldsFunc(raw, func(r rune) bool { return r == ',' || r == ' ' || r == '\n' })
}
