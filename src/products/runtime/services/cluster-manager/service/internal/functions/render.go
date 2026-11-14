package functions

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/utils/ptr"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/kube"
)

const (
	containerName     = "function"
	containerPort     = 8080
	runtimeUser       = 65532
	tokenExpiration   = 3600
	targetUtilization = "70"
	ephemeralRequest  = "128Mi"
	minCPUMillis      = 25
	IdentityMountPath = "/var/run/metorial/identity"
	TrustMountPath    = "/var/run/metorial/trust"
	BundleMountPath   = "/var/runtime/bundle"
	TmpMountPath      = "/tmp"
	ExecutionEnv      = "knative"
	TrustKeysFile     = "keys.json"
	TrustCAFile       = "ca.crt"
)

type RenderOptions struct {
	Namespace         string
	Image             string
	ServiceAccount    string
	PodAudience       string
	TrustConfigMap    string
	CAConfigMap       string
	SharedConcurrency int
	MaxScale          int
	ScaleDownDelay    string
	AutoscalingWindow string
	BootAllowanceSecs int
	CPUMillisPerGB    int64
	EphemeralStorage  resource.Quantity
	TmpSize           resource.Quantity
	BundleVolumeSize  resource.Quantity
	PodClusterManager string
	PodCMServerName   string
	EgressGatewayAddr string
	EgressServerName  string
	PolicyGate        kube.PolicyGate
}

func ValidateLabels(spec *Spec) []ValidationIssue {
	var issues []ValidationIssue
	check := func(field, value string) {
		for _, msg := range validation.IsValidLabelValue(value) {
			issues = append(issues, ValidationIssue{Path: []string{field}, Code: "invalid_identifier", Message: msg})
		}
	}
	check("versionId", spec.VersionID)
	check("functionId", spec.FunctionID)
	check("tenantId", spec.TenantID)
	return issues
}

func labelsFor(spec *Spec) map[string]string {
	return map[string]string{
		kube.LabelFunctionID: spec.FunctionID,
		kube.LabelVersionID:  spec.VersionID,
		kube.LabelTenantID:   spec.TenantID,
		kube.LabelComponent:  kube.ComponentFunction,
		kube.LabelManagedBy:  kube.ManagedBy,
	}
}

func RenderEnvSecret(opts *RenderOptions, spec *Spec) *corev1.Secret {
	data := make(map[string][]byte, len(spec.Env))
	for k, v := range spec.Env {
		// envFrom would override the kubelet's KUBERNETES_SERVICE_HOST/PORT, which the policy gate
		// probes; the supervisor keeps KUBERNETES_* from the worker anyway.
		if strings.HasPrefix(k, "KUBERNETES_") {
			continue
		}
		data[k] = []byte(v)
	}
	return &corev1.Secret{
		TypeMeta: metav1.TypeMeta{APIVersion: "v1", Kind: "Secret"},
		ObjectMeta: metav1.ObjectMeta{
			Name:      kube.FunctionEnvSecretName(spec.VersionID),
			Namespace: opts.Namespace,
			Labels:    labelsFor(spec),
		},
		Type: corev1.SecretTypeOpaque,
		Data: data,
	}
}

func RenderService(opts *RenderOptions, spec *Spec, runtimeClass string, initialScale int, reason Mode) (*kube.KnativeService, error) {
	entrypoint, err := json.Marshal(spec.Entrypoint)
	if err != nil {
		return nil, err
	}

	name := kube.FunctionName(spec.VersionID)
	labels := labelsFor(spec)

	metaLabels := labelsFor(spec)
	metaLabels[kube.LabelVisibility] = kube.VisibilityClusterLocal

	templateAnnotations := map[string]string{
		kube.AnnotationMinScale:          "0",
		kube.AnnotationMaxScale:          strconv.Itoa(opts.MaxScale),
		kube.AnnotationInitialScale:      strconv.Itoa(initialScale),
		kube.AnnotationScaleDownDelay:    opts.ScaleDownDelay,
		kube.AnnotationTargetUtilization: targetUtilization,
	}
	if opts.AutoscalingWindow != "" {
		templateAnnotations[kube.AnnotationWindow] = opts.AutoscalingWindow
	}

	concurrency := int64(1)
	if spec.Concurrency == ConcurrencyShared {
		concurrency = int64(opts.SharedConcurrency)
	}

	memory := resource.MustParse(fmt.Sprintf("%dMi", spec.MemoryMB))
	cpuMillis := max(int64(spec.MemoryMB)*opts.CPUMillisPerGB/1024, minCPUMillis)
	cpu := resource.NewMilliQuantity(cpuMillis, resource.DecimalSI)

	env := []corev1.EnvVar{
		{Name: "METORIAL_FUNCTION_ID", Value: spec.FunctionID},
		{Name: "METORIAL_FUNCTION_VERSION_ID", Value: spec.VersionID},
		{Name: "METORIAL_TENANT_ID", Value: spec.TenantID},
		{Name: "METORIAL_EXECUTION_ENV", Value: ExecutionEnv},
		{Name: "METORIAL_RUNTIME", Value: spec.RuntimeID + ":" + spec.RuntimeVersion},
		{Name: "METORIAL_ENTRYPOINT", Value: string(entrypoint)},
		{Name: "METORIAL_CONCURRENCY", Value: string(spec.Concurrency)},
		{Name: "METORIAL_TIMEOUT_SECONDS", Value: strconv.Itoa(spec.TimeoutSeconds)},
		{Name: "METORIAL_MEMORY_MB", Value: strconv.Itoa(spec.MemoryMB)},
		{Name: "METORIAL_BUNDLE_SHA256", Value: spec.Bundle.SHA256},
		{Name: "METORIAL_BUNDLE_SIZE_BYTES", Value: strconv.FormatInt(spec.Bundle.SizeBytes, 10)},
		{Name: "CLUSTER_MANAGER_POD_ADDR", Value: opts.PodClusterManager},
		{Name: "CLUSTER_MANAGER_POD_SERVER_NAME", Value: opts.PodCMServerName},
		{Name: "EGRESS_GATEWAY_ADDR", Value: opts.EgressGatewayAddr},
		{Name: "EGRESS_GATEWAY_SERVER_NAME", Value: opts.EgressServerName},
	}
	env = append(env, opts.PolicyGate.Env()...)

	podSpec := corev1.PodSpec{
		ServiceAccountName:           opts.ServiceAccount,
		AutomountServiceAccountToken: ptr.To(false),
		EnableServiceLinks:           ptr.To(false),
		Containers: []corev1.Container{{
			Name:  containerName,
			Image: opts.Image,
			Ports: []corev1.ContainerPort{{Name: "http1", ContainerPort: containerPort}},
			EnvFrom: []corev1.EnvFromSource{{
				SecretRef: &corev1.SecretEnvSource{LocalObjectReference: corev1.LocalObjectReference{Name: kube.FunctionEnvSecretName(spec.VersionID)}},
			}},
			Env: env,
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU:              *cpu,
					corev1.ResourceMemory:           memory,
					corev1.ResourceEphemeralStorage: resource.MustParse(ephemeralRequest),
				},
				Limits: corev1.ResourceList{
					corev1.ResourceMemory:           memory,
					corev1.ResourceEphemeralStorage: opts.EphemeralStorage,
				},
			},
			SecurityContext: &corev1.SecurityContext{
				RunAsNonRoot:             ptr.To(true),
				RunAsUser:                ptr.To(int64(runtimeUser)),
				SeccompProfile:           &corev1.SeccompProfile{Type: corev1.SeccompProfileTypeRuntimeDefault},
				AllowPrivilegeEscalation: ptr.To(false),
				ReadOnlyRootFilesystem:   ptr.To(true),
				Capabilities:             &corev1.Capabilities{Drop: []corev1.Capability{"ALL"}},
			},
			ReadinessProbe: &corev1.Probe{
				ProbeHandler: corev1.ProbeHandler{HTTPGet: &corev1.HTTPGetAction{Path: "/ready"}},
			},
			VolumeMounts: []corev1.VolumeMount{
				{Name: "tmp", MountPath: TmpMountPath},
				{Name: "bundle", MountPath: BundleMountPath},
				{Name: "identity", MountPath: IdentityMountPath, ReadOnly: true},
				{Name: "trust", MountPath: TrustMountPath, ReadOnly: true},
			},
		}},
		Volumes: []corev1.Volume{
			{Name: "tmp", VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{SizeLimit: ptr.To(opts.TmpSize)}}},
			{Name: "bundle", VolumeSource: corev1.VolumeSource{EmptyDir: &corev1.EmptyDirVolumeSource{SizeLimit: ptr.To(opts.BundleVolumeSize)}}},
			{Name: "identity", VolumeSource: corev1.VolumeSource{Projected: &corev1.ProjectedVolumeSource{
				Sources: []corev1.VolumeProjection{{ServiceAccountToken: &corev1.ServiceAccountTokenProjection{
					Audience:          opts.PodAudience,
					ExpirationSeconds: ptr.To(int64(tokenExpiration)),
					Path:              "token",
				}}},
			}}},
			{Name: "trust", VolumeSource: corev1.VolumeSource{Projected: &corev1.ProjectedVolumeSource{
				Sources: []corev1.VolumeProjection{
					{ConfigMap: &corev1.ConfigMapProjection{LocalObjectReference: corev1.LocalObjectReference{Name: opts.TrustConfigMap}}},
					{ConfigMap: &corev1.ConfigMapProjection{LocalObjectReference: corev1.LocalObjectReference{Name: opts.CAConfigMap}, Optional: ptr.To(true)}},
				},
			}}},
		},
	}
	if runtimeClass != "" {
		podSpec.RuntimeClassName = ptr.To(runtimeClass)
	}

	return &kube.KnativeService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: opts.Namespace,
			Labels:    metaLabels,
			Annotations: map[string]string{
				kube.AnnotationMaterializedReason: string(reason),
				kube.AnnotationBundleBucket:       spec.Bundle.Bucket,
				kube.AnnotationBundleKey:          spec.Bundle.Key,
			},
		},
		Spec: kube.KnativeServiceSpec{
			Template: kube.RevisionTemplate{
				ObjectMeta: metav1.ObjectMeta{Labels: labels, Annotations: templateAnnotations},
				Spec: kube.RevisionSpec{
					PodSpec:              podSpec,
					ContainerConcurrency: ptr.To(concurrency),
					TimeoutSeconds:       ptr.To(int64(spec.TimeoutSeconds + opts.BootAllowanceSecs)),
				},
			},
		},
	}, nil
}
