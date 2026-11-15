package supervisor

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/bundle"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/policygate"
)

const (
	MaxPayloadBytes = 6 * 1024 * 1024
	MaxLogBytes     = 1 << 20
	MaxBodyBytes    = MaxPayloadBytes + MaxLogBytes

	DefaultPort          = 8080
	DefaultTokenFile     = "/var/run/metorial/identity/token"
	DefaultKeysFile      = "/var/run/metorial/trust/keys.json"
	DefaultCAFile        = "/var/run/metorial/trust/ca.crt"
	DefaultBundleDir     = "/var/runtime/bundle"
	DefaultBootstrapPath = "/opt/runtime/bootstrap.cjs"
	DefaultNodeBinary    = "node"
)

type Mode string

const (
	ModeExclusive Mode = "exclusive"
	ModeShared    Mode = "shared"
)

type Entrypoint struct {
	Path   string `json:"path"`
	Export string `json:"export"`
	Kind   string `json:"kind"`
}

type Config struct {
	Port int

	FunctionID   string
	VersionID    string
	TenantID     string
	ExecutionEnv string
	Runtime      string
	Entrypoint   Entrypoint
	Mode         Mode
	Timeout      time.Duration
	MemoryMB     int

	BundleSHA256 string
	BundleSize   int64
	BundleLimits bundle.Limits

	ClusterManagerAddr       string
	ClusterManagerServerName string
	GatewayAddr              string
	GatewayServerName        string

	// ConfigFromEnv defaults PolicyGate to enforce; the zero value skips the gate.
	PolicyGate        policygate.Mode
	PolicyGateTargets []string
	PolicyGateTimeout time.Duration

	TokenFile string
	KeysFile  string
	CAFile    string
	BundleDir string
	SocketDir string

	NodeBinary    string
	BootstrapPath string
	NodeArgs      []string

	Environ []string
}

func ConfigFromEnv(environ []string) (*Config, error) {
	env := map[string]string{}
	for _, kv := range environ {
		if k, v, ok := strings.Cut(kv, "="); ok {
			env[k] = v
		}
	}

	cfg := &Config{
		Port:                     DefaultPort,
		FunctionID:               env["METORIAL_FUNCTION_ID"],
		VersionID:                env["METORIAL_FUNCTION_VERSION_ID"],
		TenantID:                 env["METORIAL_TENANT_ID"],
		ExecutionEnv:             env["METORIAL_EXECUTION_ENV"],
		Runtime:                  env["METORIAL_RUNTIME"],
		Mode:                     Mode(env["METORIAL_CONCURRENCY"]),
		BundleSHA256:             env["METORIAL_BUNDLE_SHA256"],
		ClusterManagerAddr:       env["CLUSTER_MANAGER_POD_ADDR"],
		ClusterManagerServerName: env["CLUSTER_MANAGER_POD_SERVER_NAME"],
		GatewayAddr:              env["EGRESS_GATEWAY_ADDR"],
		GatewayServerName:        env["EGRESS_GATEWAY_SERVER_NAME"],
		TokenFile:                DefaultTokenFile,
		KeysFile:                 DefaultKeysFile,
		CAFile:                   DefaultCAFile,
		BundleDir:                DefaultBundleDir,
		SocketDir:                os.TempDir(),
		NodeBinary:               DefaultNodeBinary,
		BootstrapPath:            DefaultBootstrapPath,
		Environ:                  environ,
	}

	var errs []error
	if port := env["PORT"]; port != "" {
		p, err := strconv.Atoi(port)
		if err != nil || p <= 0 || p > 65535 {
			errs = append(errs, fmt.Errorf("invalid PORT %q", port))
		}
		cfg.Port = p
	}

	if raw := env["METORIAL_ENTRYPOINT"]; raw != "" {
		if err := json.Unmarshal([]byte(raw), &cfg.Entrypoint); err != nil {
			errs = append(errs, fmt.Errorf("invalid METORIAL_ENTRYPOINT: %w", err))
		}
	}

	if mode, err := policygate.ParseMode(env["METORIAL_POLICY_GATE"]); err != nil {
		errs = append(errs, fmt.Errorf("METORIAL_POLICY_GATE %w", err))
	} else {
		cfg.PolicyGate = mode
	}
	// KUBERNETES_SERVICE_* come from the kubelet: the cluster-manager keeps KUBERNETES_* names out
	// of the user env Secret, which would otherwise take precedence.
	rawTargets := env["METORIAL_POLICY_GATE_TARGETS"]
	if host, port := env["KUBERNETES_SERVICE_HOST"], env["KUBERNETES_SERVICE_PORT"]; rawTargets == "" && host != "" && port != "" {
		rawTargets = net.JoinHostPort(host, port)
	}
	if targets, err := policygate.ParseTargets(rawTargets); err != nil {
		errs = append(errs, fmt.Errorf("METORIAL_POLICY_GATE_TARGETS: %w", err))
	} else {
		cfg.PolicyGateTargets = targets
	}
	if seconds, err := positiveInt(env, "METORIAL_POLICY_GATE_TIMEOUT_SECONDS"); err != nil {
		errs = append(errs, err)
	} else if seconds > 0 {
		cfg.PolicyGateTimeout = time.Duration(seconds) * time.Second
	} else {
		cfg.PolicyGateTimeout = policygate.DefaultTimeout
	}

	if seconds, err := positiveInt(env, "METORIAL_TIMEOUT_SECONDS"); err != nil {
		errs = append(errs, err)
	} else {
		cfg.Timeout = time.Duration(seconds) * time.Second
	}
	if mb, err := positiveInt(env, "METORIAL_MEMORY_MB"); err != nil {
		errs = append(errs, err)
	} else {
		cfg.MemoryMB = mb
	}
	if size, err := positiveInt(env, "METORIAL_BUNDLE_SIZE_BYTES"); err != nil {
		errs = append(errs, err)
	} else {
		cfg.BundleSize = int64(size)
	}

	if err := cfg.Validate(); err != nil {
		errs = append(errs, err)
	}
	if len(errs) > 0 {
		return nil, errors.Join(errs...)
	}
	return cfg, nil
}

func (c *Config) Validate() error {
	var errs []error
	required := map[string]string{
		"METORIAL_FUNCTION_VERSION_ID": c.VersionID,
		"METORIAL_BUNDLE_SHA256":       c.BundleSHA256,
		"CLUSTER_MANAGER_POD_ADDR":     c.ClusterManagerAddr,
		"EGRESS_GATEWAY_ADDR":          c.GatewayAddr,
	}
	for name, value := range required {
		if value == "" {
			errs = append(errs, fmt.Errorf("%s is required", name))
		}
	}
	if c.Mode != ModeExclusive && c.Mode != ModeShared {
		errs = append(errs, fmt.Errorf("METORIAL_CONCURRENCY must be exclusive or shared, got %q", c.Mode))
	}
	if c.Entrypoint.Path == "" {
		errs = append(errs, errors.New("METORIAL_ENTRYPOINT.path is required"))
	}
	if c.Entrypoint.Kind != "module" && c.Entrypoint.Kind != "enveloped" {
		errs = append(errs, fmt.Errorf("METORIAL_ENTRYPOINT.kind must be module or enveloped, got %q", c.Entrypoint.Kind))
	}
	if c.Timeout <= 0 {
		errs = append(errs, errors.New("METORIAL_TIMEOUT_SECONDS is required"))
	}
	if c.BundleSize <= 0 {
		errs = append(errs, errors.New("METORIAL_BUNDLE_SIZE_BYTES is required"))
	}
	if c.PolicyGate != "" && c.PolicyGate != policygate.ModeOff && len(c.PolicyGateTargets) == 0 {
		errs = append(errs, errors.New("the policy gate needs METORIAL_POLICY_GATE_TARGETS or KUBERNETES_SERVICE_HOST/PORT"))
	}
	return errors.Join(errs...)
}

func positiveInt(env map[string]string, name string) (int, error) {
	raw, ok := env[name]
	if !ok || raw == "" {
		return 0, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("invalid %s %q", name, raw)
	}
	return n, nil
}
