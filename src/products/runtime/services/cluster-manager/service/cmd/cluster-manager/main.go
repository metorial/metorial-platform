package main

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc/kubeauth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/access"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/api"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/auth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/builds"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/bundles"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/config"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/functions"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/gc"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/kube"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/metrics"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/objectstore"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/preflight"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/clustermanagerrpc"
)

const (
	podPort       = 52241
	flushTick     = 30 * time.Second
	capProtect    = 5 * time.Minute
	trackerMaxAge = 24 * time.Hour
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel()}))
	slog.SetDefault(log)

	if err := run(log); err != nil {
		log.Error("cluster-manager stopped", "error", err)
		os.Exit(1)
	}
}

func logLevel() slog.Level {
	var level slog.Level
	if err := level.UnmarshalText([]byte(os.Getenv("LOG_LEVEL"))); err != nil {
		return slog.LevelInfo
	}
	return level
}

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("configuration: %w", err)
	}
	if cfg.InsecureDisableControlAuth {
		if kube.InCluster() && !cfg.InsecureAllowInCluster {
			return errors.New("CLUSTER_MANAGER_INSECURE_DISABLE_CONTROL_AUTH is refused in-cluster unless CLUSTER_MANAGER_INSECURE_ALLOW_IN_CLUSTER=true")
		}
		log.Warn("control API authentication is DISABLED; never run like this outside local development")
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	platformConfig, err := kube.LoadConfig("")
	if err != nil {
		return fmt.Errorf("kubernetes config: %w", err)
	}
	platform, err := kube.NewCluster(platformConfig)
	if err != nil {
		return err
	}
	fnCluster := platform
	if cfg.FunctionsKubeconfig != "" {
		fnConfig, err := kube.LoadConfig(cfg.FunctionsKubeconfig)
		if err != nil {
			return fmt.Errorf("functions cluster config: %w", err)
		}
		if fnCluster, err = kube.NewCluster(fnConfig); err != nil {
			return err
		}
	}

	podAddr, err := podFacingAddr(ctx, cfg, platform)
	if err != nil {
		return err
	}
	log.Info("pod-facing address", "addr", podAddr)

	if err := resolveEgressGateway(ctx, cfg, platform); err != nil {
		return err
	}
	log.Info("egress gateway", "tunnel", cfg.PodEgressGatewayAddr, "proxy", cfg.BuildEgressProxyAddr)

	buildGate := kube.PolicyGate{Mode: string(cfg.PolicyGate), TimeoutSeconds: int(cfg.PolicyGateTimeout.Seconds()), Targets: cfg.PolicyGateTargets}
	functionGate := buildGate
	if cfg.FunctionsKubeconfig != "" {
		// The probe target is an address in the platform cluster.
		functionGate.Targets = ""
	}
	log.Info("policy gate", "mode", cfg.PolicyGate, "timeout", cfg.PolicyGateTimeout, "targets", cmp.Or(cfg.PolicyGateTargets, "the pod's API server"))

	m := metrics.New()
	buckets := access.NewBuckets(cfg.Buckets.FunctionsImport, cfg.Buckets.FunctionsBundle, cfg.Buckets.BuildDownload, cfg.Buckets.BuildUpload)
	store := objectstore.New(cfg.ObjectStorageURL)
	if err := store.EnsureBucket(ctx, cfg.BundleBucket); err != nil {
		log.Warn("could not ensure the bundle bucket exists", "bucket", cfg.BundleBucket, "error", err)
	}

	diskCache, err := bundles.NewDiskCache(cfg.BundleCacheDir, cfg.BundleCacheMaxBytes)
	if err != nil {
		return fmt.Errorf("bundle cache: %w", err)
	}
	bundleService := bundles.NewService(store, buckets, cfg.BundleBucket, bundles.Limits{
		MaxZipBytes:      cfg.BundleMaxZipBytes,
		MaxUnpackedBytes: cfg.BundleMaxUnpackedBytes,
		MaxEntries:       cfg.BundleMaxEntries,
	}, cfg.TempDir, diskCache, m, log)

	cache := kube.NewCache(fnCluster, platform, cfg.FunctionsNamespace, cfg.BuildsNamespace)
	if err := cache.Start(ctx); err != nil {
		return err
	}

	fnManager := functions.NewManager(functions.Options{
		Render: functions.RenderOptions{
			Namespace:         cfg.FunctionsNamespace,
			Image:             cfg.FunctionImage,
			ServiceAccount:    cfg.FunctionRuntimeSA,
			PodAudience:       cfg.PodAudience,
			TrustConfigMap:    cfg.TrustConfigMap,
			CAConfigMap:       cfg.CAConfigMap,
			SharedConcurrency: cfg.SharedConcurrency,
			MaxScale:          cfg.MaxScale,
			ScaleDownDelay:    cfg.ScaleDownDelay,
			AutoscalingWindow: cfg.AutoscalingWindow,
			BootAllowanceSecs: int(cfg.BootAllowance.Seconds()),
			CPUMillisPerGB:    cfg.FunctionCPUMillisPerGB,
			EphemeralStorage:  cfg.FunctionEphemeralStorage,
			TmpSize:           cfg.FunctionTmpSize,
			BundleVolumeSize:  cfg.FunctionBundleVolumeSize,
			PodClusterManager: podAddr,
			PodCMServerName:   cfg.PodClusterManagerServerName,
			EgressGatewayAddr: cfg.PodEgressGatewayAddr,
			EgressServerName:  cfg.PodEgressGatewayServerName,
			PolicyGate:        functionGate,
		},
		RuntimeClass:      cfg.RuntimeClass,
		DefaultSandbox:    cfg.FunctionSandbox,
		Buckets:           buckets,
		MaxMaterialized:   cfg.MaxMaterialized,
		SpeculativeWindow: cfg.SpeculativeWindow,
		SpeculativeCap:    cfg.SpeculativeInitialScaleCap,
		EnsureTimeout:     cfg.EnsureTimeout,
		InvokeMargin:      cfg.InvokeMargin,
		GatewayURL:        cfg.KnativeGatewayURL,
		FlushInterval:     cfg.LastInvokedFlushInterval,
	}, fnCluster, cache, functions.NewRPCInvoker(nil), m, log, time.Now)

	buildManager := builds.NewManager(builds.Options{
		Render: builds.RenderOptions{
			Namespace:         cfg.BuildsNamespace,
			Image:             cfg.BuildImage,
			ServiceAccount:    cfg.BuildRuntimeSA,
			PodAudience:       cfg.PodAudience,
			CAConfigMap:       cfg.CAConfigMap,
			UserNamespaces:    cfg.BuildUserNamespaces,
			CPU:               cfg.BuildCPU,
			Memory:            cfg.BuildMemory,
			EphemeralStorage:  cfg.BuildEphemeralStorage,
			WorkspaceSize:     cfg.BuildWorkspaceSize,
			TTLAfterFinished:  int32(cfg.BuildTTLAfterFinished.Seconds()),
			PodClusterManager: podAddr,
			PodCMServerName:   cfg.PodClusterManagerServerName,
			EgressProxyAddr:   cfg.BuildEgressProxyAddr,
			PolicyGate:        buildGate,
		},
		RuntimeClass:   cfg.RuntimeClass,
		DefaultSandbox: cfg.BuildSandbox,
		Buckets:        buckets,
	}, platform, cache, m, log)

	m.RegisterGauges(
		func() float64 { n, _ := fnManager.Counts(); return float64(n) },
		func() float64 { _, n := fnManager.Counts(); return float64(n) },
	)

	controlVerifier, err := auth.NewVerifier(platform.Config, cfg.ControlAudience, kubeauth.Allowlist{
		{Namespace: cfg.PlatformNamespace, Name: cfg.FunctionsCallerSA},
		{Namespace: cfg.PlatformNamespace, Name: cfg.BuildCallerSA},
	}, cfg.TempDir)
	if err != nil {
		return fmt.Errorf("control authenticator: %w", err)
	}
	podVerifiers := []*kubeauth.Verifier{}
	platformPodVerifier, err := auth.NewVerifier(platform.Config, cfg.PodAudience, nil, cfg.TempDir)
	if err != nil {
		return fmt.Errorf("pod authenticator: %w", err)
	}
	podVerifiers = append(podVerifiers, platformPodVerifier)
	if fnCluster != platform {
		fnPodVerifier, err := auth.NewVerifier(fnCluster.Config, cfg.PodAudience, nil, cfg.TempDir)
		if err != nil {
			return fmt.Errorf("functions cluster pod authenticator: %w", err)
		}
		podVerifiers = append(podVerifiers, fnPodVerifier)
	}
	controlAuthn := auth.NewAuthenticator(auth.ListenerControl, m, controlVerifier)
	podAuthn := auth.NewAuthenticator(auth.ListenerPod, m, podVerifiers...)
	controlAuth := auth.NewControlAuth(controlAuthn, cfg.PlatformNamespace, cfg.FunctionsCallerSA, cfg.BuildCallerSA, cfg.InsecureDisableControlAuth)

	status := &statusHolder{}
	if cfg.Preflight != config.PreflightOff {
		runner := &preflight.Runner{
			Config:         cfg,
			Platform:       platform,
			Functions:      fnCluster,
			ControlAuth:    controlAuthn,
			PodAuth:        podAuthn,
			DryRunFunction: fnManager.DryRun,
			DryRunBuild:    buildManager.DryRun,
			Metrics:        m,
			Log:            log,
		}
		report := runner.Run(ctx)
		status.set(report)
		if failed := report.Failed(); len(failed) > 0 {
			messages := make([]string, len(failed))
			for i, f := range failed {
				messages[i] = f.Check + ": " + f.Message
			}
			if cfg.Preflight == config.PreflightEnforce {
				return fmt.Errorf("preflight failed (set CLUSTER_MANAGER_PREFLIGHT=warn to start anyway in development):\n  %s", strings.Join(messages, "\n  "))
			}
			log.Warn("preflight failed; starting anyway because CLUSTER_MANAGER_PREFLIGHT=warn", "failures", len(failed))
		}
	}

	rpc := ldrpc.NewServer(ldrpc.ServerOptions{
		Path:         "/rpc",
		Authenticate: controlAuth.Authenticate(),
		MaxBodyBytes: api.MaxBodyBytes,
		OnError: func(ctx context.Context, call *ldrpc.CallInfo, err error) {
			log.Error("rpc call failed", "method", call.Method, "requestId", call.RequestID, "error", err)
		},
		OnCall: func(ctx context.Context, call *ldrpc.CallInfo, status int, d time.Duration) {
			m.RPCCalls.WithLabelValues(call.Method, strconv.Itoa(status)).Observe(d.Seconds())
			log.Debug("rpc call", "method", call.Method, "status", status, "durationMs", d.Milliseconds())
		},
	})
	rpc.Use(controlAuth.Middleware())
	clustermanagerrpc.Register(rpc, &api.Control{Functions: fnManager, Builds: buildManager, Bundles: bundleService})

	controlMux := http.NewServeMux()
	rpc.Mount(controlMux)

	pods := &api.Pods{
		Auth: podAuthn,
		Identities: api.PodIdentities{
			FunctionsNamespace: cfg.FunctionsNamespace,
			FunctionRuntimeSA:  cfg.FunctionRuntimeSA,
			BuildsNamespace:    cfg.BuildsNamespace,
			BuildRuntimeSA:     cfg.BuildRuntimeSA,
		},
		Functions:      fnManager,
		Builds:         buildManager,
		Bundles:        bundleService,
		Store:          store,
		Buckets:        buckets,
		MaxUploadBytes: cfg.BuildMaxUploadBytes,
		Metrics:        m,
		Log:            log,
	}

	opsMux := http.NewServeMux()
	opsMux.Handle("GET /metrics", m.Handler())
	opsMux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("ok")) })
	opsMux.HandleFunc("GET /readyz", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("ok")) })
	opsMux.HandleFunc("GET /v1/status", status.serve)

	collector := &gc.Collector{
		Target:   fnManager,
		Sweepers: []gc.Sweeper{fnManager.SweepOrphanSecrets, buildManager.SweepOrphanSecrets},
		Policy: gc.Policy{
			SpeculativeTTL:  cfg.SpeculativeTTL,
			IdleTTL:         cfg.IdleTTL,
			MaxMaterialized: cfg.MaxMaterialized,
			ProtectWindow:   capProtect,
		},
		Interval: cfg.GCInterval,
		Log:      log,
		Now:      time.Now,
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 3)
	serve := func(name, addr string, h http.Handler, tls bool) {
		wg.Go(func() {
			cert, key := "", ""
			if tls {
				cert, key = cfg.TLSCertFile, cfg.TLSKeyFile
			}
			log.Info("listening", "listener", name, "addr", addr, "tls", tls && cert != "")
			if err := api.Serve(ctx, addr, h, cert, key); err != nil {
				errCh <- fmt.Errorf("%s listener: %w", name, err)
			}
		})
	}
	serve("control", cfg.ControlAddr, controlMux, true)
	serve("pod", cfg.PodAddr, pods.Handler(), true)
	serve("ops", cfg.MetricsAddr, opsMux, false)

	wg.Go(func() {
		fnManager.Tracker().Run(ctx, flushTick, fnManager.FlushLastInvoked)
	})
	wg.Go(func() {
		collector.Run(ctx, platform.Kube, cfg.PlatformNamespace, cfg.LeaseName, cfg.PodName)
	})

	select {
	case err = <-errCh:
		stop()
	case <-ctx.Done():
	}
	wg.Wait()
	return err
}

func podFacingAddr(ctx context.Context, cfg *config.Config, platform *kube.Cluster) (string, error) {
	if cfg.PodClusterManagerAddr != "" {
		return cfg.PodClusterManagerAddr, nil
	}
	svc, err := platform.Kube.CoreV1().Services(cfg.PlatformNamespace).Get(ctx, cfg.PodClusterManagerService, metav1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("look up pod-facing Service %s: %w", cfg.PodClusterManagerService, err)
	}
	if svc.Spec.ClusterIP == "" || svc.Spec.ClusterIP == "None" {
		return "", fmt.Errorf("pod-facing Service %s has no ClusterIP", svc.Name)
	}

	port := podPort
	for _, p := range svc.Spec.Ports {
		if p.Name == "pod" || int(p.TargetPort.IntVal) == podPort {
			port = int(p.Port)
		}
	}
	scheme := "http"
	if cfg.TLSEnabled() {
		scheme = "https"
	}
	return scheme + "://" + net.JoinHostPort(svc.Spec.ClusterIP, strconv.Itoa(port)), nil
}

// resolveEgressGateway fills the gateway addresses from its Service ("name" or "namespace/name")
// unless they're set explicitly. Pods have no DNS, so they get the ClusterIP.
func resolveEgressGateway(ctx context.Context, cfg *config.Config, platform *kube.Cluster) error {
	if cfg.EgressGatewayService == "" || (cfg.PodEgressGatewayAddr != "" && cfg.BuildEgressProxyAddr != "") {
		return nil
	}
	namespace, name, ok := strings.Cut(cfg.EgressGatewayService, "/")
	if !ok {
		namespace, name = cfg.PlatformNamespace, cfg.EgressGatewayService
	}
	svc, err := platform.Kube.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("look up egress gateway Service %s: %w", cfg.EgressGatewayService, err)
	}
	if svc.Spec.ClusterIP == "" || svc.Spec.ClusterIP == "None" {
		return fmt.Errorf("egress gateway Service %s has no ClusterIP", cfg.EgressGatewayService)
	}

	ports := map[string]int{"tunnel": 8443, "proxy": 8080}
	for _, p := range svc.Spec.Ports {
		if _, known := ports[p.Name]; known {
			ports[p.Name] = int(p.Port)
		}
	}
	if cfg.PodEgressGatewayAddr == "" {
		cfg.PodEgressGatewayAddr = net.JoinHostPort(svc.Spec.ClusterIP, strconv.Itoa(ports["tunnel"]))
	}
	if cfg.BuildEgressProxyAddr == "" {
		cfg.BuildEgressProxyAddr = net.JoinHostPort(svc.Spec.ClusterIP, strconv.Itoa(ports["proxy"]))
	}
	return nil
}

type statusHolder struct {
	mu     sync.RWMutex
	report *preflight.Report
}

func (s *statusHolder) set(r *preflight.Report) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.report = r
}

func (s *statusHolder) serve(w http.ResponseWriter, _ *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"preflight": s.report})
}
