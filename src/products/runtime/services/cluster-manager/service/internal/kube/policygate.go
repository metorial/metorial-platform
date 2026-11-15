package kube

import (
	"strconv"

	corev1 "k8s.io/api/core/v1"
)

// PolicyGate configures the check function and build pods run before any user code: they wait
// until a destination NetworkPolicy must deny is unreachable (PLAN.md 7.6).
type PolicyGate struct {
	Mode           string
	TimeoutSeconds int
	// Empty means the pod probes its own API server (KUBERNETES_SERVICE_HOST/PORT).
	Targets string
}

func (g PolicyGate) Env() []corev1.EnvVar {
	env := []corev1.EnvVar{
		{Name: "METORIAL_POLICY_GATE", Value: g.Mode},
		{Name: "METORIAL_POLICY_GATE_TIMEOUT_SECONDS", Value: strconv.Itoa(g.TimeoutSeconds)},
	}
	if g.Targets != "" {
		env = append(env, corev1.EnvVar{Name: "METORIAL_POLICY_GATE_TARGETS", Value: g.Targets})
	}
	return env
}
