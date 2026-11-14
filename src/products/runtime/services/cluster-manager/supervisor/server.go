package supervisor

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/functionruntimerpc"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/bundle"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/policygate"
)

const (
	bundleFetchBudget = 2 * time.Minute
	shutdownGrace     = 30 * time.Second
)

func (s *Supervisor) Handler() http.Handler {
	srv := ldrpc.NewServer(ldrpc.ServerOptions{
		Path:         "/rpc",
		MaxBodyBytes: MaxBodyBytes,
		OnError: func(ctx context.Context, call *ldrpc.CallInfo, err error) {
			s.log.Error("rpc call failed", "method", call.Method, "error", err)
		},
	})
	functionruntimerpc.Register(srv, s)

	mux := http.NewServeMux()
	srv.Mount(mux)
	mux.HandleFunc("GET /ready", func(w http.ResponseWriter, r *http.Request) {
		if s.Ready() {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		_, _ = io.WriteString(w, s.Phase()+"\n")
	})
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "ok\n")
	})
	return mux
}

// Run boots the pod: it serves HTTP right away (readiness stays 503), fetches and unpacks the
// bundle, starts the worker and serves until ctx is cancelled.
func Run(ctx context.Context, cfg *Config, stdout io.Writer) error {
	s, err := New(cfg, stdout)
	if err != nil {
		return err
	}
	if err := DisableDumping(); err != nil {
		s.log.Warn("could not disable dumping", "error", err)
	}

	listener, err := net.Listen("tcp", ":"+strconv.Itoa(cfg.Port))
	if err != nil {
		return err
	}
	server := &http.Server{Handler: s.Handler(), ReadHeaderTimeout: 10 * time.Second}
	serveErr := make(chan error, 1)
	go func() { serveErr <- server.Serve(listener) }()

	booted := make(chan error, 1)
	go func() { booted <- s.boot(ctx) }()

	select {
	case err = <-booted:
		if err == nil {
			select {
			case <-ctx.Done():
			case err = <-serveErr:
			}
		}
	case err = <-serveErr:
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownGrace)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
	s.Close()

	if errors.Is(err, http.ErrServerClosed) {
		err = nil
	}
	return err
}

func (s *Supervisor) boot(ctx context.Context) error {
	started := time.Now()
	gate := make(chan bool, 1)
	go func() { gate <- s.passPolicyGate(ctx) }()

	stats, err := s.fetchBundle(ctx)
	if err != nil {
		return err
	}
	s.log.Info("bundle unpacked", "entries", stats.Entries, "bytes", stats.UnpackedBytes, "ms", time.Since(started).Milliseconds())

	if !<-gate {
		s.mu.Lock()
		s.setPhaseLocked(phaseGateFailed)
		s.mu.Unlock()
		return nil
	}
	return s.StartWorker()
}

// passPolicyGate reports whether the worker may start. A gate that never closes keeps the pod
// unready for good in enforce mode; the policy applies to the pod, so restarting won't help.
func (s *Supervisor) passPolicyGate(ctx context.Context) bool {
	mode := s.cfg.PolicyGate
	if mode == "" || mode == policygate.ModeOff {
		return true
	}

	gate := &policygate.Gate{Targets: s.cfg.PolicyGateTargets, Timeout: s.cfg.PolicyGateTimeout}
	res, err := gate.Wait(ctx)
	ms := res.Elapsed.Milliseconds()
	switch {
	case err != nil:
		s.log.Error("policy gate failed", "error", err)
		return false
	case res.Closed:
		s.log.Info("policy gate closed", "attempts", res.Attempts, "ms", ms)
		return true
	case mode == policygate.ModeWarn:
		s.log.Warn("NetworkPolicy is not in force; starting the worker anyway because METORIAL_POLICY_GATE=warn", "reachable", res.Open, "attempts", res.Attempts, "ms", ms)
		return true
	default:
		s.log.Error("NetworkPolicy is not in force; the worker will not start", "reachable", res.Open, "attempts", res.Attempts, "ms", ms)
		return false
	}
}

func (s *Supervisor) fetchBundle(ctx context.Context) (*bundle.Stats, error) {
	deadline := time.Now().Add(bundleFetchBudget)
	delay := 250 * time.Millisecond

	for attempt := 1; ; attempt++ {
		stats, err := bundle.Fetch(ctx, bundle.FetchOptions{
			Addr:           s.cfg.ClusterManagerAddr,
			ServerName:     s.cfg.ClusterManagerServerName,
			CAFile:         s.cfg.CAFile,
			TokenFile:      s.cfg.TokenFile,
			ExpectedSize:   s.cfg.BundleSize,
			ExpectedSHA256: s.cfg.BundleSHA256,
			Dir:            s.cfg.BundleDir,
			Limits:         s.cfg.BundleLimits,
		})
		if err == nil {
			return stats, nil
		}

		var unsafe *bundle.UnsafeArchiveError
		if errors.As(err, &unsafe) {
			return nil, err
		}
		if time.Now().Add(delay).After(deadline) {
			return nil, fmt.Errorf("fetch bundle after %d attempts: %w", attempt, err)
		}
		s.log.Warn("bundle fetch failed, retrying", "attempt", attempt, "error", err)

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}
		delay = min(5*time.Second, delay*2)
	}
}
