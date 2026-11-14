package config

import (
	"errors"
	"fmt"
	"net/netip"
	"os"
	"strconv"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/api/resource"
)

type PreflightMode string

const (
	PreflightEnforce PreflightMode = "enforce"
	PreflightWarn    PreflightMode = "warn"
	PreflightOff     PreflightMode = "off"
)

type Config struct {
	ControlAddr string
	PodAddr     string
	MetricsAddr string
	TLSCertFile string
	TLSKeyFile  string

	InsecureDisableControlAuth bool
	InsecureAllowInCluster     bool

	PlatformNamespace   string
	FunctionsNamespace  string
	BuildsNamespace     string
	FunctionsCallerSA   string
	BuildCallerSA       string
	FunctionRuntimeSA   string
	BuildRuntimeSA      string
	SelfServiceAccount  string
	PodName             string
	FunctionsKubeconfig string
	LeaseName           string
	ControlAudience     string
	PodAudience         string
	TrustConfigMap      string
	CAConfigMap         string

	FunctionImage string
	BuildImage    string

	FunctionSandbox     string
	BuildSandbox        string
	RuncRuntimeClass    string
	GVisorRuntimeClass  string
	BuildUserNamespaces bool

	SharedConcurrency          int
	MaxScale                   int
	SpeculativeInitialScaleCap int
	ScaleDownDelay             string
	AutoscalingWindow          string
	MaxMaterialized            int
	SpeculativeWindow          time.Duration
	SpeculativeTTL             time.Duration
	IdleTTL                    time.Duration
	GCInterval                 time.Duration
	BootAllowance              time.Duration
	EnsureTimeout              time.Duration
	InvokeMargin               time.Duration
	LastInvokedFlushInterval   time.Duration

	FunctionCPUMillisPerGB   int64
	FunctionEphemeralStorage resource.Quantity
	FunctionTmpSize          resource.Quantity
	FunctionBundleVolumeSize resource.Quantity
	BuildCPU                 resource.Quantity
	BuildMemory              resource.Quantity
	BuildEphemeralStorage    resource.Quantity
	BuildWorkspaceSize       resource.Quantity
	BuildTTLAfterFinished    time.Duration
	BuildMaxUploadBytes      int64

	KnativeGatewayURL string

	ObjectStorageURL string
	BundleBucket     string
	Buckets          BucketPolicy

	BundleMaxZipBytes      int64
	BundleMaxUnpackedBytes int64
	BundleMaxEntries       int
	BundleCacheDir         string
	BundleCacheMaxBytes    int64
	TempDir                string

	PodClusterManagerAddr       string
	PodClusterManagerService    string
	PodClusterManagerServerName string
	PodEgressGatewayAddr        string
	PodEgressGatewayServerName  string
	BuildEgressProxyAddr        string
	EgressGatewayService        string

	Preflight                   PreflightMode
	PreflightNetworkPolicyProbe bool
	PreflightProbeTarget        string
	PreflightMinKnativeVersion  string
	ClusterCIDRs                []netip.Prefix

	PolicyGate        PreflightMode
	PolicyGateTimeout time.Duration
	// Empty means pods probe their own API server (KUBERNETES_SERVICE_HOST/PORT).
	PolicyGateTargets string
}

type BucketPolicy struct {
	FunctionsImport []string
	FunctionsBundle []string
	BuildDownload   []string
	BuildUpload     []string
}

type loader struct {
	errs []error
}

func (l *loader) str(name, def string) string {
	if v, ok := os.LookupEnv(name); ok && v != "" {
		return v
	}
	return def
}

func (l *loader) required(name string) string {
	v := os.Getenv(name)
	if v == "" {
		l.errs = append(l.errs, fmt.Errorf("%s is required", name))
	}
	return v
}

func (l *loader) int(name string, def int) int {
	v := os.Getenv(name)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		l.errs = append(l.errs, fmt.Errorf("%s: %w", name, err))
	}
	return n
}

func (l *loader) int64(name string, def int64) int64 {
	v := os.Getenv(name)
	if v == "" {
		return def
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		l.errs = append(l.errs, fmt.Errorf("%s: %w", name, err))
	}
	return n
}

func (l *loader) bool(name string, def bool) bool {
	v := os.Getenv(name)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		l.errs = append(l.errs, fmt.Errorf("%s: %w", name, err))
	}
	return b
}

func (l *loader) duration(name string, def time.Duration) time.Duration {
	v := os.Getenv(name)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		l.errs = append(l.errs, fmt.Errorf("%s: %w", name, err))
	}
	return d
}

func (l *loader) quantity(name, def string) resource.Quantity {
	v := l.str(name, def)
	q, err := resource.ParseQuantity(v)
	if err != nil {
		l.errs = append(l.errs, fmt.Errorf("%s: %w", name, err))
	}
	return q
}

func (l *loader) list(name string, def []string) []string {
	v := os.Getenv(name)
	if v == "" {
		return def
	}
	var out []string
	for item := range strings.SplitSeq(v, ",") {
		if item = strings.TrimSpace(item); item != "" {
			out = append(out, item)
		}
	}
	return out
}

func (l *loader) oneOf(name, def string, allowed ...string) string {
	v := l.str(name, def)
	for _, a := range allowed {
		if v == a {
			return v
		}
	}
	l.errs = append(l.errs, fmt.Errorf("%s must be one of %s, got %q", name, strings.Join(allowed, ", "), v))
	return def
}

func Load() (*Config, error) {
	l := &loader{}

	artifactBuckets := l.list("CLUSTER_MANAGER_ARTIFACT_BUCKETS", []string{"artifacts"})
	bundleBucket := l.str("CLUSTER_MANAGER_BUNDLE_BUCKET", "function-bay-bundles")

	c := &Config{
		ControlAddr: l.str("CLUSTER_MANAGER_CONTROL_ADDR", ":52240"),
		PodAddr:     l.str("CLUSTER_MANAGER_POD_LISTEN_ADDR", ":52241"),
		MetricsAddr: l.str("CLUSTER_MANAGER_METRICS_ADDR", ":9090"),
		TLSCertFile: l.str("CLUSTER_MANAGER_TLS_CERT_FILE", ""),
		TLSKeyFile:  l.str("CLUSTER_MANAGER_TLS_KEY_FILE", ""),

		InsecureDisableControlAuth: l.bool("CLUSTER_MANAGER_INSECURE_DISABLE_CONTROL_AUTH", false),
		InsecureAllowInCluster:     l.bool("CLUSTER_MANAGER_INSECURE_ALLOW_IN_CLUSTER", false),

		PlatformNamespace:   l.str("CLUSTER_MANAGER_PLATFORM_NAMESPACE", defaultNamespace()),
		FunctionsNamespace:  l.str("CLUSTER_MANAGER_FUNCTIONS_NAMESPACE", "metorial-runtime-functions"),
		BuildsNamespace:     l.str("CLUSTER_MANAGER_BUILDS_NAMESPACE", "metorial-runtime-builds"),
		FunctionsCallerSA:   l.str("CLUSTER_MANAGER_FUNCTIONS_CALLER_SA", "metorial-functions"),
		BuildCallerSA:       l.str("CLUSTER_MANAGER_BUILD_CALLER_SA", "metorial-build"),
		FunctionRuntimeSA:   l.str("CLUSTER_MANAGER_FUNCTION_RUNTIME_SA", "function-runtime"),
		BuildRuntimeSA:      l.str("CLUSTER_MANAGER_BUILD_RUNTIME_SA", "build-runtime"),
		SelfServiceAccount:  l.str("CLUSTER_MANAGER_SERVICE_ACCOUNT", "runtime-cluster-manager"),
		PodName:             l.str("POD_NAME", hostname()),
		FunctionsKubeconfig: l.str("CLUSTER_MANAGER_FUNCTIONS_KUBECONFIG", ""),
		LeaseName:           l.str("CLUSTER_MANAGER_LEASE_NAME", "runtime-cluster-manager-gc"),
		ControlAudience:     l.str("CLUSTER_MANAGER_CONTROL_AUDIENCE", "metorial-cluster-manager"),
		PodAudience:         l.str("CLUSTER_MANAGER_POD_AUDIENCE", "metorial-cluster-manager-pods"),
		TrustConfigMap:      l.str("CLUSTER_MANAGER_TRUST_CONFIGMAP", "runtime-trust"),
		CAConfigMap:         l.str("CLUSTER_MANAGER_CA_CONFIGMAP", "runtime-ca"),

		FunctionImage: l.required("CLUSTER_MANAGER_FUNCTION_IMAGE_NODE24"),
		BuildImage:    l.required("CLUSTER_MANAGER_BUILD_IMAGE_UBUNTU"),

		FunctionSandbox:     l.oneOf("CLUSTER_MANAGER_FUNCTION_SANDBOX", "runc", "runc", "gvisor"),
		BuildSandbox:        l.str("CLUSTER_MANAGER_BUILD_SANDBOX", ""),
		RuncRuntimeClass:    l.str("CLUSTER_MANAGER_RUNC_RUNTIME_CLASS", ""),
		GVisorRuntimeClass:  l.str("CLUSTER_MANAGER_GVISOR_RUNTIME_CLASS", ""),
		BuildUserNamespaces: l.bool("CLUSTER_MANAGER_BUILD_USER_NAMESPACES", false),

		SharedConcurrency:          l.int("CLUSTER_MANAGER_SHARED_CONCURRENCY", 25),
		MaxScale:                   l.int("CLUSTER_MANAGER_FUNCTION_MAX_SCALE", 20),
		SpeculativeInitialScaleCap: l.int("CLUSTER_MANAGER_SPECULATIVE_INITIAL_SCALE_CAP", 3),
		ScaleDownDelay:             l.str("CLUSTER_MANAGER_SCALE_DOWN_DELAY", "0s"),
		AutoscalingWindow:          l.str("CLUSTER_MANAGER_AUTOSCALING_WINDOW", ""),
		MaxMaterialized:            l.int("CLUSTER_MANAGER_MAX_MATERIALIZED", 1000),
		SpeculativeWindow:          l.duration("CLUSTER_MANAGER_SPECULATIVE_WINDOW", 24*time.Hour),
		SpeculativeTTL:             l.duration("CLUSTER_MANAGER_SPECULATIVE_TTL", time.Hour),
		IdleTTL:                    l.duration("CLUSTER_MANAGER_IDLE_TTL", 6*time.Hour),
		GCInterval:                 l.duration("CLUSTER_MANAGER_GC_INTERVAL", time.Minute),
		BootAllowance:              l.duration("CLUSTER_MANAGER_BOOT_ALLOWANCE", 60*time.Second),
		EnsureTimeout:              l.duration("CLUSTER_MANAGER_ENSURE_TIMEOUT", 2*time.Minute),
		InvokeMargin:               l.duration("CLUSTER_MANAGER_INVOKE_MARGIN", 5*time.Second),
		LastInvokedFlushInterval:   l.duration("CLUSTER_MANAGER_LAST_INVOKED_FLUSH_INTERVAL", 5*time.Minute),

		FunctionCPUMillisPerGB:   l.int64("CLUSTER_MANAGER_FUNCTION_CPU_MILLIS_PER_GB", 500),
		FunctionEphemeralStorage: l.quantity("CLUSTER_MANAGER_FUNCTION_EPHEMERAL_STORAGE", "2Gi"),
		FunctionTmpSize:          l.quantity("CLUSTER_MANAGER_FUNCTION_TMP_SIZE", "512Mi"),
		FunctionBundleVolumeSize: l.quantity("CLUSTER_MANAGER_FUNCTION_BUNDLE_VOLUME_SIZE", "1Gi"),
		BuildCPU:                 l.quantity("CLUSTER_MANAGER_BUILD_CPU", "2"),
		BuildMemory:              l.quantity("CLUSTER_MANAGER_BUILD_MEMORY", "4Gi"),
		BuildEphemeralStorage:    l.quantity("CLUSTER_MANAGER_BUILD_EPHEMERAL_STORAGE", "10Gi"),
		BuildWorkspaceSize:       l.quantity("CLUSTER_MANAGER_BUILD_WORKSPACE_SIZE", "8Gi"),
		BuildTTLAfterFinished:    l.duration("CLUSTER_MANAGER_BUILD_TTL_AFTER_FINISHED", time.Hour),
		BuildMaxUploadBytes:      l.int64("CLUSTER_MANAGER_BUILD_MAX_UPLOAD_BYTES", 5<<30),

		KnativeGatewayURL: l.str("CLUSTER_MANAGER_KNATIVE_GATEWAY_URL", ""),

		ObjectStorageURL: l.required("OBJECT_STORAGE_URL"),
		BundleBucket:     bundleBucket,
		Buckets: BucketPolicy{
			FunctionsImport: l.list("CLUSTER_MANAGER_FUNCTIONS_IMPORT_BUCKETS", append(append([]string{}, artifactBuckets...), bundleBucket)),
			FunctionsBundle: l.list("CLUSTER_MANAGER_FUNCTIONS_BUNDLE_BUCKETS", []string{bundleBucket}),
			BuildDownload:   l.list("CLUSTER_MANAGER_BUILD_DOWNLOAD_BUCKETS", artifactBuckets),
			BuildUpload:     l.list("CLUSTER_MANAGER_BUILD_UPLOAD_BUCKETS", artifactBuckets),
		},

		BundleMaxZipBytes:      l.int64("CLUSTER_MANAGER_BUNDLE_MAX_ZIP_BYTES", 512<<20),
		BundleMaxUnpackedBytes: l.int64("CLUSTER_MANAGER_BUNDLE_MAX_UNPACKED_BYTES", 1<<30),
		BundleMaxEntries:       l.int("CLUSTER_MANAGER_BUNDLE_MAX_ENTRIES", 100_000),
		BundleCacheDir:         l.str("CLUSTER_MANAGER_BUNDLE_CACHE_DIR", ""),
		BundleCacheMaxBytes:    l.int64("CLUSTER_MANAGER_BUNDLE_CACHE_MAX_BYTES", 2<<30),
		TempDir:                l.str("CLUSTER_MANAGER_TMP_DIR", os.TempDir()),

		PodClusterManagerAddr:       l.str("CLUSTER_MANAGER_POD_ADDR", ""),
		PodClusterManagerService:    l.str("CLUSTER_MANAGER_POD_SERVICE", ""),
		PodClusterManagerServerName: l.str("CLUSTER_MANAGER_POD_SERVER_NAME", ""),
		PodEgressGatewayAddr:        l.str("CLUSTER_MANAGER_POD_EGRESS_GATEWAY_ADDR", ""),
		PodEgressGatewayServerName:  l.str("CLUSTER_MANAGER_POD_EGRESS_GATEWAY_SERVER_NAME", ""),
		BuildEgressProxyAddr:        l.str("CLUSTER_MANAGER_BUILD_EGRESS_PROXY_ADDR", ""),
		EgressGatewayService:        l.str("CLUSTER_MANAGER_EGRESS_GATEWAY_SERVICE", ""),

		Preflight:                   PreflightMode(l.oneOf("CLUSTER_MANAGER_PREFLIGHT", string(PreflightEnforce), string(PreflightEnforce), string(PreflightWarn), string(PreflightOff))),
		PreflightNetworkPolicyProbe: l.bool("CLUSTER_MANAGER_PREFLIGHT_NETWORK_POLICY_PROBE", true),
		PreflightProbeTarget:        l.str("CLUSTER_MANAGER_PREFLIGHT_PROBE_TARGET", ""),
		PreflightMinKnativeVersion:  l.str("CLUSTER_MANAGER_PREFLIGHT_MIN_KNATIVE_VERSION", "1.22.0"),

		PolicyGate:        PreflightMode(l.oneOf("CLUSTER_MANAGER_POLICY_GATE", "", "", string(PreflightEnforce), string(PreflightWarn), string(PreflightOff))),
		PolicyGateTimeout: l.duration("CLUSTER_MANAGER_POLICY_GATE_TIMEOUT", 30*time.Second),
	}

	for _, cidr := range l.list("CLUSTER_MANAGER_CLUSTER_CIDRS", nil) {
		prefix, err := netip.ParsePrefix(cidr)
		if err != nil {
			l.errs = append(l.errs, fmt.Errorf("CLUSTER_MANAGER_CLUSTER_CIDRS: %w", err))
			continue
		}
		c.ClusterCIDRs = append(c.ClusterCIDRs, prefix.Masked())
	}

	// The gate follows preflight unless set: a cluster whose NetworkPolicy enforcement isn't
	// probed would never see the gate close.
	if c.PolicyGate == "" {
		c.PolicyGate = c.Preflight
		if !c.PreflightNetworkPolicyProbe {
			c.PolicyGate = PreflightOff
		}
	}
	if c.PolicyGateTimeout < time.Second {
		l.errs = append(l.errs, fmt.Errorf("CLUSTER_MANAGER_POLICY_GATE_TIMEOUT must be at least 1s"))
	}
	// Pods have no DNS, so only an ip:port probe target carries over to the gate.
	if target, err := netip.ParseAddrPort(c.PreflightProbeTarget); err == nil {
		c.PolicyGateTargets = target.String()
	}

	if c.BuildSandbox == "" {
		c.BuildSandbox = "runc"
		if c.GVisorRuntimeClass != "" {
			c.BuildSandbox = "gvisor"
		}
	}
	if c.BuildSandbox != "runc" && c.BuildSandbox != "gvisor" {
		l.errs = append(l.errs, fmt.Errorf("CLUSTER_MANAGER_BUILD_SANDBOX must be runc or gvisor"))
	}
	if (c.FunctionSandbox == "gvisor" || c.BuildSandbox == "gvisor") && c.GVisorRuntimeClass == "" {
		l.errs = append(l.errs, fmt.Errorf("a gvisor sandbox default needs CLUSTER_MANAGER_GVISOR_RUNTIME_CLASS"))
	}
	if (c.TLSCertFile == "") != (c.TLSKeyFile == "") {
		l.errs = append(l.errs, fmt.Errorf("CLUSTER_MANAGER_TLS_CERT_FILE and CLUSTER_MANAGER_TLS_KEY_FILE must be set together"))
	}
	if c.PodClusterManagerAddr == "" && c.PodClusterManagerService == "" {
		l.errs = append(l.errs, fmt.Errorf("one of CLUSTER_MANAGER_POD_ADDR or CLUSTER_MANAGER_POD_SERVICE is required"))
	}
	if c.SharedConcurrency < 1 || c.MaxMaterialized < 1 || c.MaxScale < 0 || c.SpeculativeInitialScaleCap < 0 {
		l.errs = append(l.errs, fmt.Errorf("concurrency, cap and scale settings must be positive"))
	}

	if len(l.errs) > 0 {
		return nil, errors.Join(l.errs...)
	}
	return c, nil
}

// RuntimeClass maps a sandbox to its RuntimeClass name; an empty name means the cluster default.
func (c *Config) RuntimeClass(sandbox string) (string, error) {
	switch sandbox {
	case "runc":
		return c.RuncRuntimeClass, nil
	case "gvisor":
		if c.GVisorRuntimeClass == "" {
			return "", fmt.Errorf("the gvisor sandbox is not configured on this installation")
		}
		return c.GVisorRuntimeClass, nil
	default:
		return "", fmt.Errorf("unknown sandbox %q", sandbox)
	}
}

func (c *Config) TLSEnabled() bool {
	return c.TLSCertFile != ""
}

func defaultNamespace() string {
	if b, err := os.ReadFile("/var/run/secrets/kubernetes.io/serviceaccount/namespace"); err == nil {
		return strings.TrimSpace(string(b))
	}
	return "metorial"
}

func hostname() string {
	h, _ := os.Hostname()
	return h
}
