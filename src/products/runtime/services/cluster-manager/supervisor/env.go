package supervisor

import (
	"encoding/json"
	"strconv"
	"strings"
)

const ControlFD = 3

var reservedEnvNames = map[string]bool{
	"NODE_OPTIONS":        true,
	"NODE_PATH":           true,
	"NODE_EXTRA_CA_CERTS": true,
	"PORT":                true,
	"K_SERVICE":           true,
	"K_CONFIGURATION":     true,
	"K_REVISION":          true,
}

var reservedEnvPrefixes = []string{"LD_", "METORIAL_", "CLUSTER_MANAGER_", "EGRESS_GATEWAY_", "KUBERNETES_"}

func IsReservedEnvName(name string) bool {
	if reservedEnvNames[name] {
		return true
	}
	for _, prefix := range reservedEnvPrefixes {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}
	return false
}

func workerEnv(cfg *Config, socketPath string) []string {
	env := make([]string, 0, len(cfg.Environ)+12)
	for _, kv := range cfg.Environ {
		name, _, ok := strings.Cut(kv, "=")
		if !ok || name == "" || IsReservedEnvName(name) {
			continue
		}
		env = append(env, kv)
	}

	entrypoint, _ := json.Marshal(cfg.Entrypoint)
	set := func(name, value string) {
		env = append(env, name+"="+value)
	}

	set("METORIAL_FUNCTION_ID", cfg.FunctionID)
	set("METORIAL_FUNCTION_VERSION_ID", cfg.VersionID)
	set("METORIAL_EXECUTION_ENV", cfg.ExecutionEnv)
	set("METORIAL_RUNTIME", cfg.Runtime)
	set("METORIAL_ENTRYPOINT", string(entrypoint))
	set("METORIAL_CONCURRENCY", string(cfg.Mode))
	set("METORIAL_TIMEOUT_SECONDS", strconv.Itoa(int(cfg.Timeout.Seconds())))
	if cfg.MemoryMB > 0 {
		set("METORIAL_MEMORY_MB", strconv.Itoa(cfg.MemoryMB))
	}
	set("METORIAL_BUNDLE_DIR", cfg.BundleDir)
	set("METORIAL_SUPERVISOR_SOCKET", socketPath)
	set("METORIAL_CONTROL_FD", strconv.Itoa(ControlFD))
	return env
}

func nodeArgs(cfg *Config) []string {
	args := []string{}
	if cfg.MemoryMB > 0 {
		args = append(args, "--max-old-space-size="+strconv.Itoa(cfg.MemoryMB*85/100))
	}
	args = append(args, cfg.NodeArgs...)
	return append(args, cfg.BootstrapPath)
}
