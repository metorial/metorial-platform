package builds

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/utils/ptr"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/kube"
)

const (
	containerName      = "build"
	BuildMountPath     = "/var/run/metorial/build"
	IdentityMountPath  = "/var/run/metorial/identity"
	TrustMountPath     = "/var/run/metorial/trust"
	WorkspacePath      = "/workspace"
	SecretKeyScript    = "script.sh"
	SecretKeyEnv       = "env"
	SecretKeySpec      = "spec.json"
	SecretKeyProxyURL  = "proxy-url"
	tokenExpiration    = 3600
	terminationSeconds = 10
)

// policyGate is the build-pod copy of the supervisor's policygate loop: the script only runs
// once no target accepts a connection. It runs before the user env is sourced, so the build
// can't steer it, and an unknown mode counts as enforce.
const policyGate = `metorial_policy_gate() {
  local mode="${METORIAL_POLICY_GATE:-enforce}" targets="$METORIAL_POLICY_GATE_TARGETS" list target host open deadline
  case "$mode" in off) return 0 ;; warn) ;; *) mode=enforce ;; esac
  if [ -z "$targets" ] && [ -n "$KUBERNETES_SERVICE_HOST" ]; then targets="$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT"; fi
  IFS=, read -ra list <<<"$targets"
  if [ "${#list[@]}" -eq 0 ]; then echo "policy gate: no targets to probe" >&2; return 1; fi
  deadline=$((SECONDS + ${METORIAL_POLICY_GATE_TIMEOUT_SECONDS:-30}))
  while :; do
    open=
    for target in "${list[@]}"; do
      host=${target%:*}; host=${host#[}; host=${host%]}
      if timeout 0.1 bash -c 'exec 3<>"/dev/tcp/$0/$1"' "$host" "${target##*:}" 2>/dev/null; then open=$target; break; fi
    done
    [ -z "$open" ] && return 0
    if [ "$SECONDS" -ge "$deadline" ]; then
      if [ "$mode" = warn ]; then echo "policy gate: NetworkPolicy is not in force ($open is reachable); running the build anyway" >&2; return 0; fi
      echo "policy gate: NetworkPolicy is not in force ($open is reachable); not running the build" >&2
      return 1
    fi
    sleep 0.05
  done
}
metorial_policy_gate || exit 1
`

var launch = policyGate + fmt.Sprintf("set -a; . %s/%s; set +a; exec /bin/bash %s/%s", BuildMountPath, SecretKeyEnv, BuildMountPath, SecretKeyScript)

type Download struct {
	ArtifactID string `json:"artifactId"`
	Bucket     string `json:"bucket"`
	Key        string `json:"key"`
}

type Upload struct {
	StepID string `json:"stepId"`
	Bucket string `json:"bucket"`
	Key    string `json:"key"`
}

// BuildSpec is stored in the Job's Secret under spec.json, which is never mounted into the pod.
type BuildSpec struct {
	RunID     string     `json:"runId"`
	Downloads []Download `json:"downloads"`
	Uploads   []Upload   `json:"uploads"`
}

func (s *BuildSpec) Download(artifactID string) (Download, bool) {
	for _, d := range s.Downloads {
		if d.ArtifactID == artifactID {
			return d, true
		}
	}
	return Download{}, false
}

func (s *BuildSpec) Upload(stepID string) (Upload, bool) {
	for _, u := range s.Uploads {
		if u.StepID == stepID {
			return u, true
		}
	}
	return Upload{}, false
}

type StartRequest struct {
	RunID          string
	Image          string
	Script         string
	Env            map[string]string
	Downloads      []Download
	Uploads        []Upload
	TimeoutSeconds int
	Sandbox        string
	EgressGrant    string
}

type RenderOptions struct {
	Namespace         string
	Image             string
	ServiceAccount    string
	PodAudience       string
	CAConfigMap       string
	UserNamespaces    bool
	CPU               resource.Quantity
	Memory            resource.Quantity
	EphemeralStorage  resource.Quantity
	WorkspaceSize     resource.Quantity
	TTLAfterFinished  int32
	PodClusterManager string
	PodCMServerName   string
	EgressProxyAddr   string
	PolicyGate        kube.PolicyGate
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
	return "invalid build: " + strings.Join(parts, "; ")
}

var shellNamePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// Narrower than the function list: forge passes function-bay's METORIAL_FUNCTION_BAY_* build
// settings through, and the build pod itself only sets METORIAL_BUILD_* and METORIAL_POLICY_GATE*.
var reservedBuildEnvPrefixes = []string{"METORIAL_BUILD_", "METORIAL_POLICY_GATE", "CLUSTER_MANAGER_", "EGRESS_GATEWAY_"}

var reservedBuildEnvNames = map[string]bool{
	"HTTP_PROXY": true, "HTTPS_PROXY": true, "NO_PROXY": true, "ALL_PROXY": true,
	"http_proxy": true, "https_proxy": true, "no_proxy": true, "all_proxy": true,
}

func Validate(req *StartRequest) []ValidationIssue {
	var issues []ValidationIssue

	for _, msg := range validation.IsValidLabelValue(req.RunID) {
		issues = append(issues, ValidationIssue{Path: []string{"runId"}, Code: "invalid_identifier", Message: msg})
	}

	names := make([]string, 0, len(req.Env))
	for name := range req.Env {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		reserved := reservedBuildEnvNames[name]
		for _, prefix := range reservedBuildEnvPrefixes {
			reserved = reserved || strings.HasPrefix(name, prefix)
		}
		switch {
		case reserved:
			issues = append(issues, ValidationIssue{Path: []string{"env", name}, Code: "reserved_name", Message: name + " is reserved by the runtime"})
		case !shellNamePattern.MatchString(name):
			issues = append(issues, ValidationIssue{Path: []string{"env", name}, Code: "invalid_name", Message: name + " is not a valid shell variable name"})
		}
	}

	seen := map[string]bool{}
	for i, d := range req.Downloads {
		if seen["a:"+d.ArtifactID] {
			issues = append(issues, ValidationIssue{Path: []string{"downloads", fmt.Sprint(i), "artifactId"}, Code: "duplicate", Message: "duplicate artifactId"})
		}
		seen["a:"+d.ArtifactID] = true
	}
	for i, u := range req.Uploads {
		if seen["s:"+u.StepID] {
			issues = append(issues, ValidationIssue{Path: []string{"uploads", fmt.Sprint(i), "stepId"}, Code: "duplicate", Message: "duplicate stepId"})
		}
		seen["s:"+u.StepID] = true
	}
	return issues
}

// RenderEnvFile writes env as shell assignments, single-quoted so values are never expanded.
func RenderEnvFile(env map[string]string) string {
	names := make([]string, 0, len(env))
	for name := range env {
		names = append(names, name)
	}
	sort.Strings(names)

	var b strings.Builder
	for _, name := range names {
		b.WriteString(name)
		b.WriteString("='")
		b.WriteString(strings.ReplaceAll(env[name], "'", `'\''`))
		b.WriteString("'\n")
	}
	return b.String()
}

func proxyURL(grant, addr string) string {
	if addr == "" {
		return ""
	}
	return "http://" + grant + ":x@" + addr
}

func labelsFor(runID string) map[string]string {
	return map[string]string{
		kube.LabelBuildID:   runID,
		kube.LabelComponent: kube.ComponentBuild,
		kube.LabelManagedBy: kube.ManagedBy,
	}
}

func RenderSecret(opts *RenderOptions, req *StartRequest) (*corev1.Secret, error) {
	spec, err := json.Marshal(BuildSpec{RunID: req.RunID, Downloads: nonNil(req.Downloads), Uploads: nonNil(req.Uploads)})
	if err != nil {
		return nil, err
	}

	return &corev1.Secret{
		TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Secret"},
		ObjectMeta: metav1.ObjectMeta{
			Name:        kube.BuildName(req.RunID),
			Namespace:   opts.Namespace,
			Labels:      labelsFor(req.RunID),
			Annotations: map[string]string{kube.AnnotationRunID: req.RunID},
		},
		Type: corev1.SecretTypeOpaque,
		Data: map[string][]byte{
			SecretKeyScript:   []byte(req.Script),
			SecretKeyEnv:      []byte(RenderEnvFile(req.Env)),
			SecretKeySpec:     spec,
			SecretKeyProxyURL: []byte(proxyURL(req.EgressGrant, opts.EgressProxyAddr)),
		},
	}, nil
}

func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

func noProxy(podAddr string) string {
	host := podAddr
	if i := strings.Index(host, "://"); i >= 0 {
		host = host[i+3:]
	}
	host = strings.TrimSuffix(host, "/")
	if h, _, ok := strings.Cut(host, ":"); ok && !strings.HasPrefix(host, "[") {
		host = h
	}
	return host
}

func RenderJob(opts *RenderOptions, req *StartRequest, runtimeClass string) *batchv1.Job {
	name := kube.BuildName(req.RunID)
	labels := labelsFor(req.RunID)

	env := []corev1.EnvVar{
		{Name: "METORIAL_BUILD_RUN_ID", Value: req.RunID},
		{Name: "CLUSTER_MANAGER_POD_ADDR", Value: opts.PodClusterManager},
		{Name: "CLUSTER_MANAGER_POD_SERVER_NAME", Value: opts.PodCMServerName},
		{Name: "CLUSTER_MANAGER_TOKEN_FILE", Value: IdentityMountPath + "/token"},
	}
	env = append(env, opts.PolicyGate.Env()...)
	if opts.EgressProxyAddr != "" {
		// The proxy URL carries the build grant, so it comes from the Secret rather than the pod spec.
		for _, n := range []string{"HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"} {
			env = append(env, corev1.EnvVar{Name: n, ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
				LocalObjectReference: corev1.LocalObjectReference{Name: name},
				Key:                  SecretKeyProxyURL,
			}}})
		}
		noProxyValue := noProxy(opts.PodClusterManager)
		env = append(env, corev1.EnvVar{Name: "NO_PROXY", Value: noProxyValue}, corev1.EnvVar{Name: "no_proxy", Value: noProxyValue})
	}

	podSpec := corev1.PodSpec{
		RestartPolicy:                 corev1.RestartPolicyNever,
		ServiceAccountName:            opts.ServiceAccount,
		AutomountServiceAccountToken:  ptr.To(false),
		EnableServiceLinks:            ptr.To(false),
		TerminationGracePeriodSeconds: ptr.To(int64(terminationSeconds)),
		Containers: []corev1.Container{{
			Name:       containerName,
			Image:      opts.Image,
			Command:    []string{"/bin/bash", "-c", launch},
			WorkingDir: WorkspacePath,
			Env:        env,
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU:              opts.CPU,
					corev1.ResourceMemory:           opts.Memory,
					corev1.ResourceEphemeralStorage: opts.EphemeralStorage,
				},
				Limits: corev1.ResourceList{
					corev1.ResourceCPU:              opts.CPU,
					corev1.ResourceMemory:           opts.Memory,
					corev1.ResourceEphemeralStorage: opts.EphemeralStorage,
				},
			},
			SecurityContext: &corev1.SecurityContext{
				AllowPrivilegeEscalation: ptr.To(false),
				SeccompProfile:           &corev1.SeccompProfile{Type: corev1.SeccompProfileTypeRuntimeDefault},
				Capabilities:             &corev1.Capabilities{Drop: []corev1.Capability{"NET_RAW"}},
			},
			VolumeMounts: []corev1.VolumeMount{
				{Name: "workspace", MountPath: WorkspacePath},
				{Name: "build", MountPath: BuildMountPath, ReadOnly: true},
				{Name: "identity", MountPath: IdentityMountPath, ReadOnly: true},
				{Name: "trust", MountPath: TrustMountPath, ReadOnly: true},
			},
		}},
		Volumes: []corev1.Volume{
			{Name: "workspace", VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{SizeLimit: ptr.To(opts.WorkspaceSize)}}},
			{Name: "build", VolumeSource: corev1.VolumeSource{Secret: &corev1.SecretVolumeSource{
				SecretName:  name,
				DefaultMode: ptr.To(int32(0o444)),
				Items: []corev1.KeyToPath{
					{Key: SecretKeyScript, Path: SecretKeyScript},
					{Key: SecretKeyEnv, Path: SecretKeyEnv},
				},
			}}},
			{Name: "identity", VolumeSource: corev1.VolumeSource{Projected: &corev1.ProjectedVolumeSource{
				Sources: []corev1.VolumeProjection{{ServiceAccountToken: &corev1.ServiceAccountTokenProjection{
					Audience:          opts.PodAudience,
					ExpirationSeconds: ptr.To(int64(tokenExpiration)),
					Path:              "token",
				}}},
			}}},
			{Name: "trust", VolumeSource: corev1.VolumeSource{Projected: &corev1.ProjectedVolumeSource{
				Sources: []corev1.VolumeProjection{
					{ConfigMap: &corev1.ConfigMapProjection{LocalObjectReference: corev1.LocalObjectReference{Name: opts.CAConfigMap}, Optional: ptr.To(true)}},
				},
			}}},
		},
	}
	if runtimeClass != "" {
		podSpec.RuntimeClassName = ptr.To(runtimeClass)
	}
	if opts.UserNamespaces {
		podSpec.HostUsers = ptr.To(false)
	}

	return &batchv1.Job{
		TypeMeta: metav1.TypeMeta{APIVersion: "batch/v1", Kind: "Job"},
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Namespace:   opts.Namespace,
			Labels:      labels,
			Annotations: map[string]string{kube.AnnotationRunID: req.RunID},
		},
		Spec: batchv1.JobSpec{
			BackoffLimit:            ptr.To(int32(0)),
			ActiveDeadlineSeconds:   ptr.To(int64(req.TimeoutSeconds)),
			TTLSecondsAfterFinished: ptr.To(opts.TTLAfterFinished),
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: labels},
				Spec:       podSpec,
			},
		},
	}
}
