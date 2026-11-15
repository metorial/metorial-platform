package functions

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"
)

type Mode string

const (
	ModeOnDemand    Mode = "on-demand"
	ModeSpeculative Mode = "speculative"
)

type Concurrency string

const (
	ConcurrencyExclusive Concurrency = "exclusive"
	ConcurrencyShared    Concurrency = "shared"
)

type BundleRef struct {
	Bucket    string
	Key       string
	SHA256    string
	SizeBytes int64
}

type Entrypoint struct {
	Path   string `json:"path"`
	Export string `json:"export"`
	Kind   string `json:"kind"`
}

type Spec struct {
	VersionID      string
	FunctionID     string
	TenantID       string
	RuntimeID      string
	RuntimeVersion string
	Entrypoint     Entrypoint
	Bundle         BundleRef
	Env            map[string]string
	MemoryMB       int
	TimeoutSeconds int
	Concurrency    Concurrency
	Sandbox        string
}

type EnsureRequest struct {
	Spec
	Mode Mode
}

type EnsureState string

const (
	StateMaterialized EnsureState = "materialized"
	StateDeclined     EnsureState = "declined"
)

type EnsureResult struct {
	State EnsureState
	Name  string
}

type Materialized struct {
	VersionID     string
	Name          string
	Warm          bool
	ReadyPods     int
	Reason        Mode
	LastInvokedAt *time.Time
	CreatedAt     time.Time
}

type ValidationIssue struct {
	Path    []string
	Code    string
	Message string
}

type ValidationError struct {
	Issues []ValidationIssue
}

func (e *ValidationError) Error() string {
	parts := make([]string, len(e.Issues))
	for i, issue := range e.Issues {
		parts[i] = strings.Join(issue.Path, ".") + ": " + issue.Message
	}
	return "invalid function spec: " + strings.Join(parts, "; ")
}

var reservedEnvPrefixes = []string{"LD_", "METORIAL_", "CLUSTER_MANAGER_", "EGRESS_GATEWAY_"}

var reservedEnvNames = map[string]bool{
	"NODE_OPTIONS":        true,
	"NODE_PATH":           true,
	"NODE_EXTRA_CA_CERTS": true,
}

// Names Kubernetes accepts for envFrom keys and that a POSIX environment can carry.
var envNamePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_.\-]*$`)

func IsReservedEnv(name string) bool {
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

func ValidateEnv(env map[string]string) []ValidationIssue {
	names := make([]string, 0, len(env))
	for name := range env {
		names = append(names, name)
	}
	sort.Strings(names)

	var issues []ValidationIssue
	for _, name := range names {
		switch {
		case IsReservedEnv(name):
			issues = append(issues, ValidationIssue{
				Path:    []string{"env", name},
				Code:    "reserved_name",
				Message: fmt.Sprintf("%s is reserved by the runtime", name),
			})
		case !envNamePattern.MatchString(name):
			issues = append(issues, ValidationIssue{
				Path:    []string{"env", name},
				Code:    "invalid_name",
				Message: fmt.Sprintf("%s is not a valid environment variable name", name),
			})
		}
	}
	return issues
}
