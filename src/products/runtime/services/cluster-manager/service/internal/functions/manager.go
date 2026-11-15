package functions

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/access"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/gc"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/kube"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/metrics"
)

const (
	MaxPayloadBytes   = 6 * 1024 * 1024
	readyPollInterval = 200 * time.Millisecond
	deletionWait      = 60 * time.Second
	orphanSecretAge   = 10 * time.Minute
	capacityProtect   = 5 * time.Minute
)

var (
	ErrNotMaterialized = errors.New("function version is not materialized")
	ErrUnavailable     = errors.New("no ready instance answered before the deadline")
	ErrCapacity        = errors.New("materialization cap reached and nothing can be evicted")
)

type NotReadyError struct {
	Reason string
}

func (e *NotReadyError) Error() string {
	return "function did not become ready: " + e.Reason
}

type UnauthorizedError struct {
	Reason string
}

func (e *UnauthorizedError) Error() string {
	return "invocation rejected: " + e.Reason
}

type Options struct {
	Render            RenderOptions
	RuntimeClass      func(sandbox string) (string, error)
	DefaultSandbox    string
	Buckets           *access.Buckets
	MaxMaterialized   int
	SpeculativeWindow time.Duration
	SpeculativeCap    int
	EnsureTimeout     time.Duration
	InvokeMargin      time.Duration
	GatewayURL        string
	FlushInterval     time.Duration
}

type Manager struct {
	opts    Options
	cluster *kube.Cluster
	cache   *kube.Cache
	invoker Invoker
	tracker *Tracker
	metrics *metrics.Metrics
	log     *slog.Logger
	now     func() time.Time
}

func NewManager(opts Options, cluster *kube.Cluster, cache *kube.Cache, invoker Invoker, m *metrics.Metrics, log *slog.Logger, now func() time.Time) *Manager {
	if now == nil {
		now = time.Now
	}
	return &Manager{
		opts:    opts,
		cluster: cluster,
		cache:   cache,
		invoker: invoker,
		tracker: NewTracker(opts.FlushInterval, now),
		metrics: m,
		log:     log,
		now:     now,
	}
}

func (m *Manager) Tracker() *Tracker {
	return m.tracker
}

func (m *Manager) namespace() string {
	return m.opts.Render.Namespace
}

func (m *Manager) services() serviceClient {
	return serviceClient{m.cluster.Dynamic.Resource(kube.KnativeServiceGVR).Namespace(m.namespace())}
}

func (m *Manager) Validate(req *EnsureRequest) (string, error) {
	var issues []ValidationIssue
	issues = append(issues, ValidateLabels(&req.Spec)...)
	issues = append(issues, ValidateEnv(req.Env)...)

	sandbox := req.Sandbox
	if sandbox == "" {
		sandbox = m.opts.DefaultSandbox
	}
	runtimeClass, err := m.opts.RuntimeClass(sandbox)
	if err != nil {
		issues = append(issues, ValidationIssue{Path: []string{"sandbox"}, Code: "unsupported", Message: err.Error()})
	}
	if req.Concurrency != ConcurrencyExclusive && req.Concurrency != ConcurrencyShared {
		issues = append(issues, ValidationIssue{Path: []string{"concurrency"}, Code: "invalid_enum", Message: "concurrency must be exclusive or shared"})
	}

	if len(issues) > 0 {
		return "", &ValidationError{Issues: issues}
	}
	if err := m.opts.Buckets.Check(access.UseFunctionsBundle, req.Bundle.Bucket); err != nil {
		return "", err
	}
	return runtimeClass, nil
}

func (m *Manager) Ensure(ctx context.Context, req *EnsureRequest) (result *EnsureResult, err error) {
	start := m.now()
	defer func() {
		outcome := "error"
		if err == nil {
			outcome = string(result.State)
		}
		m.metrics.EnsureDuration.WithLabelValues(string(req.Mode), outcome).Observe(m.now().Sub(start).Seconds())
	}()

	runtimeClass, err := m.Validate(req)
	if err != nil {
		return nil, err
	}

	name := kube.FunctionName(req.VersionID)
	materialized := &EnsureResult{State: StateMaterialized, Name: name}

	existing, err := m.currentService(ctx, name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		if err := m.ensureSecret(ctx, &req.Spec, existing); err != nil {
			return nil, err
		}
		if req.Mode == ModeOnDemand {
			if err := m.waitReady(ctx, name); err != nil {
				return nil, err
			}
		}
		return materialized, nil
	}

	initialScale := 1
	if req.Mode == ModeSpeculative {
		scale, ok := m.speculativeScale(req.FunctionID, req.VersionID)
		if !ok {
			m.metrics.EnsureDeclined.WithLabelValues("no_recent_sibling").Inc()
			return &EnsureResult{State: StateDeclined}, nil
		}
		initialScale = scale
	}

	if err := m.makeRoom(ctx, name, req.Mode); err != nil {
		if errors.Is(err, ErrCapacity) && req.Mode == ModeSpeculative {
			m.metrics.EnsureDeclined.WithLabelValues("cap").Inc()
			return &EnsureResult{State: StateDeclined}, nil
		}
		return nil, err
	}

	svc, err := RenderService(&m.opts.Render, &req.Spec, runtimeClass, initialScale, req.Mode)
	if err != nil {
		return nil, err
	}
	if err := m.writeSecret(ctx, RenderEnvSecret(&m.opts.Render, &req.Spec)); err != nil {
		return nil, err
	}

	created, err := m.services().create(ctx, svc)
	switch {
	case apierrors.IsAlreadyExists(err):
		created, err = m.services().get(ctx, name)
		if err != nil {
			return nil, err
		}
	case err != nil:
		return nil, fmt.Errorf("create knative service %s: %w", name, err)
	default:
		m.log.Info("materialized function version", "name", name, "versionId", req.VersionID, "mode", req.Mode, "initialScale", initialScale)
	}

	if err := m.ensureSecret(ctx, &req.Spec, created); err != nil {
		return nil, err
	}

	if req.Mode == ModeOnDemand {
		if err := m.waitReady(ctx, name); err != nil {
			return nil, err
		}
	}
	return materialized, nil
}

// currentService returns the live Knative Service, waiting out a pending deletion so a version
// that GC is removing gets recreated instead of reported as materialized.
func (m *Manager) currentService(ctx context.Context, name string) (*kube.KnativeService, error) {
	svc, ok, err := m.cache.KnativeService(name)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}
	if svc.DeletionTimestamp == nil {
		return svc, nil
	}

	waitCtx, cancel := context.WithTimeout(ctx, deletionWait)
	defer cancel()
	for {
		_, err := m.services().get(waitCtx, name)
		if apierrors.IsNotFound(err) {
			return nil, nil
		}
		select {
		case <-waitCtx.Done():
			return nil, &NotReadyError{Reason: "the previous materialization is still being deleted"}
		case <-time.After(readyPollInterval):
		}
	}
}

func (m *Manager) writeSecret(ctx context.Context, secret *corev1.Secret) error {
	secrets := m.cluster.Kube.CoreV1().Secrets(m.namespace())
	_, err := secrets.Create(ctx, secret, metav1.CreateOptions{})
	if !apierrors.IsAlreadyExists(err) {
		return err
	}

	existing, err := secrets.Get(ctx, secret.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	existing.Data = secret.Data
	existing.Labels = secret.Labels
	_, err = secrets.Update(ctx, existing, metav1.UpdateOptions{})
	return err
}

// ensureSecret makes sure the env Secret exists and is owned by the Knative Service, so deleting
// the Service garbage-collects it. The Secret is written before the Service (pods need it to
// start) and adopted afterwards; GC removes Secrets orphaned by a crash in between.
func (m *Manager) ensureSecret(ctx context.Context, spec *Spec, svc *kube.KnativeService) error {
	secrets := m.cluster.Kube.CoreV1().Secrets(m.namespace())
	owner := metav1.OwnerReference{
		APIVersion: kube.KnativeAPIVersion,
		Kind:       kube.KnativeKind,
		Name:       svc.Name,
		UID:        svc.UID,
	}

	secret, err := secrets.Get(ctx, kube.FunctionEnvSecretName(spec.VersionID), metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		desired := RenderEnvSecret(&m.opts.Render, spec)
		desired.OwnerReferences = []metav1.OwnerReference{owner}
		_, err = secrets.Create(ctx, desired, metav1.CreateOptions{})
		if apierrors.IsAlreadyExists(err) {
			return m.ensureSecret(ctx, spec, svc)
		}
		return err
	}
	if err != nil {
		return err
	}

	for _, ref := range secret.OwnerReferences {
		if ref.UID == svc.UID {
			return nil
		}
	}
	patch, _ := json.Marshal(map[string]any{"metadata": map[string]any{"ownerReferences": []metav1.OwnerReference{owner}}})
	_, err = secrets.Patch(ctx, secret.Name, types.MergePatchType, patch, metav1.PatchOptions{})
	return err
}

func (m *Manager) waitReady(ctx context.Context, name string) error {
	timeout := m.opts.EnsureTimeout
	if deadline, ok := ctx.Deadline(); ok {
		timeout = min(timeout, time.Until(deadline)-time.Second)
	}
	waitCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	reason := "timed out waiting for the Knative Service to become ready"
	for {
		svc, ok, err := m.cache.KnativeService(name)
		if err != nil {
			return err
		}
		if ok {
			readiness, why := svc.Readiness()
			if readiness == kube.ReadinessReady {
				return nil
			}
			if why != "" {
				reason = why
			}
		}

		select {
		case <-waitCtx.Done():
			return &NotReadyError{Reason: reason}
		case <-time.After(readyPollInterval):
		}
	}
}

func (m *Manager) lastInvoked(svc *kube.KnativeService) *time.Time {
	var last *time.Time
	if value := svc.Annotations[kube.AnnotationLastInvokedAt]; value != "" {
		if t, err := time.Parse(time.RFC3339, value); err == nil {
			last = &t
		}
	}
	if t, ok := m.tracker.LastInvoked(svc.Labels[kube.LabelVersionID]); ok && (last == nil || t.After(*last)) {
		last = &t
	}
	return last
}

func (m *Manager) podCounts(versionID string) (all, ready int) {
	for _, pod := range m.cache.FunctionPodsForVersion(versionID) {
		if pod.DeletionTimestamp != nil || pod.Status.Phase == corev1.PodSucceeded || pod.Status.Phase == corev1.PodFailed {
			continue
		}
		all++
		if kube.PodReady(pod) {
			ready++
		}
	}
	return all, ready
}

func (m *Manager) speculativeScale(functionID, versionID string) (int, bool) {
	siblings, err := m.cache.KnativeServices(labels.SelectorFromSet(labels.Set{kube.LabelFunctionID: functionID}))
	if err != nil {
		return 0, false
	}

	cutoff := m.now().Add(-m.opts.SpeculativeWindow)
	found := false
	scale := 0
	for _, sibling := range siblings {
		siblingVersion := sibling.Labels[kube.LabelVersionID]
		if siblingVersion == versionID || sibling.DeletionTimestamp != nil {
			continue
		}
		last := m.lastInvoked(sibling)
		if last == nil || last.Before(cutoff) {
			continue
		}
		found = true
		_, ready := m.podCounts(siblingVersion)
		scale = max(scale, ready)
	}
	return min(scale, m.opts.SpeculativeCap), found
}

func (m *Manager) Candidates() ([]gc.Candidate, error) {
	services, err := m.cache.KnativeServices(labels.Everything())
	if err != nil {
		return nil, err
	}

	candidates := make([]gc.Candidate, 0, len(services))
	for _, svc := range services {
		if svc.DeletionTimestamp != nil {
			continue
		}
		versionID := svc.Labels[kube.LabelVersionID]
		pods, _ := m.podCounts(versionID)
		candidates = append(candidates, gc.Candidate{
			Name:          svc.Name,
			UID:           string(svc.UID),
			VersionID:     versionID,
			Speculative:   svc.Annotations[kube.AnnotationMaterializedReason] == string(ModeSpeculative),
			CreatedAt:     svc.CreationTimestamp.Time,
			LastInvokedAt: m.lastInvoked(svc),
			Pods:          pods,
		})
	}
	return candidates, nil
}

func (m *Manager) makeRoom(ctx context.Context, name string, mode Mode) error {
	candidates, err := m.Candidates()
	if err != nil {
		return err
	}

	others := candidates[:0]
	for _, c := range candidates {
		if c.Name != name {
			others = append(others, c)
		}
	}
	excess := len(others) - m.opts.MaxMaterialized + 1
	if excess <= 0 {
		return nil
	}
	if mode == ModeSpeculative {
		return ErrCapacity
	}

	victims := gc.SelectLRU(m.now(), others, excess, capacityProtect)
	if len(victims) < excess {
		return ErrCapacity
	}
	for _, victim := range victims {
		if err := m.Evict(ctx, victim, gc.ReasonCap); err != nil {
			return err
		}
	}
	return nil
}

// Evict deletes a Knative Service only if it is still the object GC looked at, so a version
// recreated in the meantime survives.
func (m *Manager) Evict(ctx context.Context, c gc.Candidate, reason gc.Reason) error {
	opts := metav1.DeleteOptions{PropagationPolicy: ptr.To(metav1.DeletePropagationBackground)}
	if c.UID != "" {
		opts.Preconditions = &metav1.Preconditions{UID: ptr.To(types.UID(c.UID))}
	}

	err := m.services().delete(ctx, c.Name, opts)
	if apierrors.IsNotFound(err) || apierrors.IsConflict(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("evict %s: %w", c.Name, err)
	}

	m.tracker.Forget(c.VersionID)
	m.metrics.GCEvictions.WithLabelValues(string(reason)).Inc()
	m.log.Info("evicted function version", "name", c.Name, "versionId", c.VersionID, "reason", reason)
	return nil
}

func (m *Manager) Delete(ctx context.Context, versionID string) error {
	name := kube.FunctionName(versionID)
	opts := metav1.DeleteOptions{PropagationPolicy: ptr.To(metav1.DeletePropagationBackground)}

	if err := m.services().delete(ctx, name, opts); err != nil && !apierrors.IsNotFound(err) {
		return err
	}
	err := m.cluster.Kube.CoreV1().Secrets(m.namespace()).Delete(ctx, kube.FunctionEnvSecretName(versionID), opts)
	if err != nil && !apierrors.IsNotFound(err) {
		return err
	}
	m.tracker.Forget(versionID)
	return nil
}

func (m *Manager) List(functionID string) ([]Materialized, error) {
	services, err := m.cache.KnativeServices(labels.SelectorFromSet(labels.Set{kube.LabelFunctionID: functionID}))
	if err != nil {
		return nil, err
	}

	items := make([]Materialized, 0, len(services))
	for _, svc := range services {
		if svc.DeletionTimestamp != nil {
			continue
		}
		versionID := svc.Labels[kube.LabelVersionID]
		_, ready := m.podCounts(versionID)
		reason := ModeOnDemand
		if svc.Annotations[kube.AnnotationMaterializedReason] == string(ModeSpeculative) {
			reason = ModeSpeculative
		}
		items = append(items, Materialized{
			VersionID:     versionID,
			Name:          svc.Name,
			Warm:          ready > 0,
			ReadyPods:     ready,
			Reason:        reason,
			LastInvokedAt: m.lastInvoked(svc),
			CreatedAt:     svc.CreationTimestamp.Time,
		})
	}
	return items, nil
}

func (m *Manager) Counts() (materialized, warm int) {
	services, err := m.cache.KnativeServices(labels.Everything())
	if err != nil {
		return 0, 0
	}
	for _, svc := range services {
		if svc.DeletionTimestamp != nil {
			continue
		}
		materialized++
		if _, ready := m.podCounts(svc.Labels[kube.LabelVersionID]); ready > 0 {
			warm++
		}
	}
	return materialized, warm
}

func (m *Manager) Invoke(ctx context.Context, req *InvokeInput) (out *InvokeOutput, err error) {
	start := m.now()
	defer func() {
		m.metrics.InvokeDuration.WithLabelValues(invokeOutcome(err)).Observe(m.now().Sub(start).Seconds())
	}()

	if len(req.PayloadJSON) > MaxPayloadBytes {
		return nil, &ValidationError{Issues: []ValidationIssue{{
			Path:    []string{"payloadJson"},
			Code:    "too_big",
			Message: fmt.Sprintf("payloadJson exceeds %d bytes", MaxPayloadBytes),
		}}}
	}

	name := kube.FunctionName(req.VersionID)
	svc, ok, err := m.cache.KnativeService(name)
	if err != nil {
		return nil, err
	}
	if !ok || svc.DeletionTimestamp != nil {
		m.metrics.NotMaterialized.Inc()
		return nil, ErrNotMaterialized
	}

	m.tracker.Record(req.VersionID, name)

	target := m.target(svc)
	timeout := time.Duration(req.DeadlineMs)*time.Millisecond + m.opts.InvokeMargin

	out, err = m.invoker.Invoke(ctx, target, req, timeout)
	if err != nil {
		return nil, mapInvokeError(err)
	}
	return out, nil
}

func (m *Manager) target(svc *kube.KnativeService) Target {
	host := kube.FunctionHost(svc.Name, svc.Namespace)
	if m.opts.GatewayURL != "" {
		return Target{URL: strings.TrimSuffix(m.opts.GatewayURL, "/") + "/rpc", Host: host}
	}
	if svc.Status.Address != nil && svc.Status.Address.URL != "" {
		return Target{URL: strings.TrimSuffix(svc.Status.Address.URL, "/") + "/rpc"}
	}
	return Target{URL: "http://" + host + "/rpc"}
}

func invokeOutcome(err error) string {
	var unauthorized *UnauthorizedError
	var invalid *ValidationError
	switch {
	case err == nil:
		return "ok"
	case errors.Is(err, ErrNotMaterialized):
		return "not_materialized"
	case errors.Is(err, ErrUnavailable):
		return "unavailable"
	case errors.As(err, &unauthorized):
		return "unauthorized"
	case errors.As(err, &invalid):
		return "invalid"
	default:
		return "error"
	}
}

func (m *Manager) FlushLastInvoked(ctx context.Context, f Flush) error {
	patch, _ := json.Marshal(map[string]any{"metadata": map[string]any{"annotations": map[string]string{
		kube.AnnotationLastInvokedAt: f.At.UTC().Format(time.RFC3339),
	}}})
	err := m.services().patch(ctx, f.Name, patch)
	switch {
	case apierrors.IsNotFound(err):
		m.metrics.LastInvokedFlushes.WithLabelValues("gone").Inc()
		return nil
	case err != nil:
		m.metrics.LastInvokedFlushes.WithLabelValues("error").Inc()
		m.log.Warn("failed to record last invocation", "name", f.Name, "error", err)
		return err
	default:
		m.metrics.LastInvokedFlushes.WithLabelValues("ok").Inc()
		return nil
	}
}

// DryRun submits a rendered Knative Service with server-side dry run, once per configured
// sandbox, so Knative's webhook and any admission policy see the real template.
func (m *Manager) DryRun(ctx context.Context) error {
	for _, sandbox := range []string{"runc", "gvisor"} {
		runtimeClass, err := m.opts.RuntimeClass(sandbox)
		if err != nil {
			continue
		}
		spec := &Spec{
			VersionID:      "preflight-" + sandbox,
			FunctionID:     "preflight",
			TenantID:       "preflight",
			RuntimeID:      "nodejs",
			RuntimeVersion: "24",
			Entrypoint:     Entrypoint{Path: "index.js", Export: "handler", Kind: "module"},
			Bundle:         BundleRef{Bucket: "preflight", Key: "preflight.tar.zst", SHA256: strings.Repeat("0", 64), SizeBytes: 1},
			Env:            map[string]string{"EXAMPLE": "1"},
			MemoryMB:       256,
			TimeoutSeconds: 900,
			Concurrency:    ConcurrencyShared,
			Sandbox:        sandbox,
		}
		svc, err := RenderService(&m.opts.Render, spec, runtimeClass, 0, ModeSpeculative)
		if err != nil {
			return err
		}
		if err := m.services().dryRun(ctx, svc); err != nil {
			return fmt.Errorf("sandbox %s: %w", sandbox, err)
		}
	}
	return nil
}

var ErrPodUnknown = errors.New("caller is not a known function pod")

// ResolvePod maps an authenticated function pod to the bundle of its version, using the pod's
// version label and the bundle reference recorded on that version's Knative Service.
func (m *Manager) ResolvePod(ctx context.Context, podName, podUID string) (bucket, key string, err error) {
	pod, ok := m.cache.FunctionPod(podName)
	if !ok {
		pod, err = m.cluster.Kube.CoreV1().Pods(m.namespace()).Get(ctx, podName, metav1.GetOptions{})
		if err != nil {
			return "", "", ErrPodUnknown
		}
	}
	if podUID == "" || string(pod.UID) != podUID {
		return "", "", ErrPodUnknown
	}

	versionID := pod.Labels[kube.LabelVersionID]
	if versionID == "" {
		return "", "", ErrPodUnknown
	}
	svc, ok, err := m.cache.KnativeService(kube.FunctionName(versionID))
	if err != nil || !ok || svc.Labels[kube.LabelVersionID] != versionID {
		return "", "", ErrPodUnknown
	}

	bucket, key = svc.Annotations[kube.AnnotationBundleBucket], svc.Annotations[kube.AnnotationBundleKey]
	if key == "" {
		return "", "", ErrPodUnknown
	}
	if err := m.opts.Buckets.Check(access.UseFunctionsBundle, bucket); err != nil {
		return "", "", err
	}
	return bucket, key, nil
}

// SweepOrphanSecrets deletes env Secrets whose Knative Service was never created or adopted them.
func (m *Manager) SweepOrphanSecrets(ctx context.Context) error {
	selector := labels.SelectorFromSet(labels.Set{kube.LabelComponent: kube.ComponentFunction, kube.LabelManagedBy: kube.ManagedBy}).String()
	secrets, err := m.cluster.Kube.CoreV1().Secrets(m.namespace()).List(ctx, metav1.ListOptions{LabelSelector: selector})
	if err != nil {
		return err
	}

	for _, secret := range secrets.Items {
		if len(secret.OwnerReferences) > 0 || m.now().Sub(secret.CreationTimestamp.Time) < orphanSecretAge {
			continue
		}
		if _, ok, _ := m.cache.KnativeService(kube.FunctionName(secret.Labels[kube.LabelVersionID])); ok {
			continue
		}
		err := m.cluster.Kube.CoreV1().Secrets(m.namespace()).Delete(ctx, secret.Name, metav1.DeleteOptions{
			Preconditions: &metav1.Preconditions{UID: &secret.UID},
		})
		if err != nil && !apierrors.IsNotFound(err) && !apierrors.IsConflict(err) {
			return err
		}
		m.log.Info("deleted orphaned env secret", "name", secret.Name)
	}
	return nil
}
