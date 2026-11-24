package builds

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/access"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/kube"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/metrics"
)

const (
	defaultLogLimit = 1000
	orphanSecretAge = 10 * time.Minute
)

var (
	ErrNotFound      = errors.New("build not found")
	ErrPodUnknown    = errors.New("caller is not a known build pod")
	ErrBuildFinished = errors.New("the build has finished")
)

type Status string

const (
	StatusPending   Status = "pending"
	StatusRunning   Status = "running"
	StatusSucceeded Status = "succeeded"
	StatusFailed    Status = "failed"
)

type Build struct {
	RunID         string
	Name          string
	Status        Status
	ExitCode      *int
	FailureReason *string
	FailureCode   string
	PendingReason *string
	PendingCode   string
	UploadedSteps []string
	StartedAt     *time.Time
	FinishedAt    *time.Time
}

type Options struct {
	Render         RenderOptions
	RuntimeClass   func(sandbox string) (string, error)
	DefaultSandbox string
	Buckets        *access.Buckets
}

type Manager struct {
	opts    Options
	cluster *kube.Cluster
	cache   *kube.Cache
	metrics *metrics.Metrics
	log     *slog.Logger
	now     func() time.Time
}

func NewManager(opts Options, cluster *kube.Cluster, cache *kube.Cache, m *metrics.Metrics, log *slog.Logger) *Manager {
	return &Manager{opts: opts, cluster: cluster, cache: cache, metrics: m, log: log, now: time.Now}
}

func (m *Manager) namespace() string {
	return m.opts.Render.Namespace
}

func (m *Manager) Prepare(req *StartRequest) (*corev1.Secret, *batchv1.Job, error) {
	issues := Validate(req)

	sandbox := req.Sandbox
	if sandbox == "" {
		sandbox = m.opts.DefaultSandbox
	}
	runtimeClass, err := m.opts.RuntimeClass(sandbox)
	if err != nil {
		issues = append(issues, ValidationIssue{Path: []string{"sandbox"}, Code: "unsupported", Message: err.Error()})
	}
	if req.Image != "build-ubuntu" {
		issues = append(issues, ValidationIssue{Path: []string{"image"}, Code: "invalid_enum", Message: "image must be build-ubuntu"})
	}
	if len(issues) > 0 {
		return nil, nil, &ValidationError{Issues: issues}
	}

	for _, d := range req.Downloads {
		if err := m.opts.Buckets.Check(access.UseBuildDownload, d.Bucket); err != nil {
			return nil, nil, err
		}
	}
	for _, u := range req.Uploads {
		if err := m.opts.Buckets.Check(access.UseBuildUpload, u.Bucket); err != nil {
			return nil, nil, err
		}
	}

	secret, err := RenderSecret(&m.opts.Render, req)
	if err != nil {
		return nil, nil, err
	}
	return secret, RenderJob(&m.opts.Render, req, runtimeClass), nil
}

func (m *Manager) Start(ctx context.Context, req *StartRequest) (*Build, error) {
	secret, job, err := m.Prepare(req)
	if err != nil {
		return nil, err
	}

	if existing, err := m.job(ctx, job.Name); err == nil {
		return m.view(existing), nil
	} else if !errors.Is(err, ErrNotFound) {
		return nil, err
	}

	secrets := m.cluster.Kube.CoreV1().Secrets(m.namespace())
	if _, err := secrets.Create(ctx, secret, metav1.CreateOptions{}); apierrors.IsAlreadyExists(err) {
		current, err := secrets.Get(ctx, secret.Name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		current.Data = secret.Data
		if _, err := secrets.Update(ctx, current, metav1.UpdateOptions{}); err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, admissionError("create build secret", err)
	}

	created, err := m.cluster.Kube.BatchV1().Jobs(m.namespace()).Create(ctx, job, metav1.CreateOptions{FieldManager: kube.ManagedBy})
	switch {
	case apierrors.IsAlreadyExists(err):
		created, err = m.cluster.Kube.BatchV1().Jobs(m.namespace()).Get(ctx, job.Name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
	case err != nil:
		return nil, admissionError("create build job", err)
	default:
		m.metrics.BuildsStarted.Inc()
		m.log.Info("started build", "runId", req.RunID, "job", created.Name)
	}

	owner := metav1.OwnerReference{APIVersion: "batch/v1", Kind: "Job", Name: created.Name, UID: created.UID}
	patch, _ := json.Marshal(map[string]any{"metadata": map[string]any{"ownerReferences": []metav1.OwnerReference{owner}}})
	if _, err := secrets.Patch(ctx, secret.Name, types.MergePatchType, patch, metav1.PatchOptions{}); err != nil {
		return nil, fmt.Errorf("adopt build secret: %w", err)
	}

	return m.view(created), nil
}

func (m *Manager) job(ctx context.Context, name string) (*batchv1.Job, error) {
	if job, ok := m.cache.BuildJob(name); ok {
		return job, nil
	}
	job, err := m.cluster.Kube.BatchV1().Jobs(m.namespace()).Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil, ErrNotFound
	}
	return job, err
}

func (m *Manager) Get(ctx context.Context, runID string) (*Build, error) {
	job, err := m.job(ctx, kube.BuildName(runID))
	if err != nil {
		return nil, err
	}
	pod := m.latestPod(job)
	build := buildView(job, pod)
	if build.Status == StatusPending && build.PendingReason == nil {
		if pod == nil {
			m.describeFailedCreate(ctx, job, build)
		} else if event := m.latestWarningEvent(ctx, pod.UID, ""); event != nil && event.Reason != "FailedScheduling" {
			build.PendingReason = ptr.To(describeReason(event.Reason, event.Message))
			build.PendingCode = "startup"
		}
	}
	return build, nil
}

func (m *Manager) latestPod(job *batchv1.Job) *corev1.Pod {
	pods := m.cache.BuildPodsForJob(job.Name)
	var latest *corev1.Pod
	for _, pod := range pods {
		if latest == nil || pod.CreationTimestamp.After(latest.CreationTimestamp.Time) {
			latest = pod
		}
	}
	return latest
}

func (m *Manager) view(job *batchv1.Job) *Build {
	return buildView(job, m.latestPod(job))
}

func buildView(job *batchv1.Job, pod *corev1.Pod) *Build {
	b := &Build{
		RunID:         job.Labels[kube.LabelBuildID],
		Name:          job.Name,
		Status:        StatusPending,
		UploadedSteps: uploadedSteps(job),
	}
	if pod != nil {
		for _, cs := range pod.Status.ContainerStatuses {
			if cs.Name != containerName {
				continue
			}
			if r := cs.State.Running; r != nil && !r.StartedAt.IsZero() {
				b.StartedAt = ptr.To(r.StartedAt.Time)
			}
			if t := cs.State.Terminated; t != nil {
				if !t.StartedAt.IsZero() {
					b.StartedAt = ptr.To(t.StartedAt.Time)
				}
				if !t.FinishedAt.IsZero() {
					b.FinishedAt = ptr.To(t.FinishedAt.Time)
				}
				b.ExitCode = ptr.To(int(t.ExitCode))
				if t.Reason != "" && t.Reason != "Completed" && t.Reason != "Error" {
					b.FailureReason = ptr.To(t.Reason)
				}
				if t.Reason == "OOMKilled" {
					b.FailureCode = "build_out_of_memory"
				}
			}
		}
		if pod.Status.Phase == corev1.PodRunning {
			b.Status = StatusRunning
		}
		if pod.Status.Phase == corev1.PodPending {
			b.PendingReason = podPendingReason(pod)
			if b.PendingReason != nil {
				b.PendingCode = classifyPendingReason(*b.PendingReason)
			}
		}
		if pod.Status.Phase == corev1.PodFailed && pod.Status.Reason != "" && b.FailureReason == nil {
			b.FailureReason = ptr.To(describeReason(pod.Status.Reason, pod.Status.Message))
			if pod.Status.Reason == "Evicted" {
				b.FailureCode = "build_pod_evicted"
			}
		}
	}

	finished, succeeded := kube.JobFinished(job)
	if finished {
		b.Status = StatusFailed
		if succeeded {
			b.Status = StatusSucceeded
		}
		for _, c := range job.Status.Conditions {
			if c.Status != corev1.ConditionTrue {
				continue
			}
			if c.Type == batchv1.JobFailed {
				if b.FailureReason == nil {
					b.FailureReason = ptr.To(describeReason(c.Reason, c.Message))
				}
				if b.FailureCode == "" && c.Reason == batchv1.JobReasonDeadlineExceeded {
					b.FailureCode = "build_deadline_exceeded"
				}
			}
			if b.FinishedAt == nil && (c.Type == batchv1.JobComplete || c.Type == batchv1.JobFailed) {
				b.FinishedAt = ptr.To(c.LastTransitionTime.Time)
			}
		}
		if b.FinishedAt == nil && job.Status.CompletionTime != nil {
			b.FinishedAt = ptr.To(job.Status.CompletionTime.Time)
		}
	}
	return b
}

// podPendingReason explains why a build pod has not started: the scheduler could not place it
// (e.g. insufficient memory) or its container is stuck waiting (e.g. an image pull failure).
func podPendingReason(pod *corev1.Pod) *string {
	for _, c := range pod.Status.Conditions {
		if c.Type == corev1.PodScheduled && c.Status == corev1.ConditionFalse && c.Reason != "" {
			return ptr.To(describeReason(c.Reason, c.Message))
		}
	}
	for _, cs := range pod.Status.ContainerStatuses {
		if w := cs.State.Waiting; w != nil && w.Reason != "" && w.Reason != "ContainerCreating" && w.Reason != "PodInitializing" {
			return ptr.To(describeReason(w.Reason, w.Message))
		}
	}
	return nil
}

type AdmissionError struct {
	Quota  bool
	Reason string
}

func (e *AdmissionError) Error() string { return e.Reason }

func admissionError(action string, err error) error {
	if apierrors.IsForbidden(err) || apierrors.IsUnauthorized(err) ||
		apierrors.IsInvalid(err) || apierrors.IsBadRequest(err) {
		return &AdmissionError{
			Quota:  isQuotaMessage(err.Error()),
			Reason: describeReason(action, err.Error()),
		}
	}
	return fmt.Errorf("%s: %w", action, err)
}

func isQuotaMessage(message string) bool {
	return strings.Contains(strings.ToLower(message), "exceeded quota:")
}

func describeReason(reason, message string) string {
	if message == "" {
		return reason
	}
	return reason + ": " + message
}

func classifyPendingReason(reason string) string {
	if strings.HasPrefix(reason, "Unschedulable:") {
		message := strings.ToLower(reason)
		if strings.Contains(message, "insufficient ") || strings.Contains(message, "too many pods") {
			return "capacity"
		}
		return "scheduling"
	}
	return "startup"
}

func (m *Manager) describeFailedCreate(ctx context.Context, job *batchv1.Job, build *Build) {
	if job.Status.Active != 0 {
		return
	}

	latest := m.latestWarningEvent(ctx, job.UID, "FailedCreate")
	if latest == nil {
		return
	}

	reason := describeReason(latest.Reason, latest.Message)
	build.PendingReason = ptr.To(reason)
	switch message := strings.ToLower(latest.Message); {
	case isQuotaMessage(message):
		build.PendingCode = "quota"
	case strings.Contains(message, "forbidden") || strings.Contains(message, "denied the request") ||
		strings.Contains(message, " is invalid"):
		build.Status = StatusFailed
		build.FailureCode = "build_admission_rejected"
		build.FailureReason = ptr.To(reason)
	default:
		build.PendingCode = "startup"
	}
}

func (m *Manager) latestWarningEvent(ctx context.Context, uid types.UID, reason string) *corev1.Event {
	selector := fields.Set{"involvedObject.uid": string(uid), "type": corev1.EventTypeWarning}
	if reason != "" {
		selector["reason"] = reason
	}

	events, err := m.cluster.Kube.CoreV1().Events(m.namespace()).List(ctx, metav1.ListOptions{
		FieldSelector: selector.AsSelector().String(),
	})
	if err != nil {
		m.log.Debug("could not read build events", "uid", uid, "error", err)
		return nil
	}

	var latest *corev1.Event
	var latestAt time.Time
	for i := range events.Items {
		event := &events.Items[i]
		at := event.LastTimestamp.Time
		if event.Series != nil {
			at = event.Series.LastObservedTime.Time
		} else if at.IsZero() {
			at = event.EventTime.Time
		}
		if latest == nil || at.After(latestAt) {
			latest, latestAt = event, at
		}
	}
	return latest
}

type uploadRecord struct {
	StepID    string    `json:"stepId"`
	At        time.Time `json:"at"`
	SizeBytes int64     `json:"sizeBytes"`
}

func uploadedSteps(job *batchv1.Job) []string {
	steps := []string{}
	for key, value := range job.Annotations {
		if !strings.HasPrefix(key, kube.AnnotationUploadPrefix) {
			continue
		}
		var record uploadRecord
		if json.Unmarshal([]byte(value), &record) == nil && record.StepID != "" {
			steps = append(steps, record.StepID)
		}
	}
	sort.Strings(steps)
	return steps
}

func (m *Manager) Logs(ctx context.Context, runID, cursorValue string, limit int) ([]LogLine, string, error) {
	cursor, err := ParseCursor(cursorValue)
	if err != nil {
		return nil, "", &ValidationError{Issues: []ValidationIssue{{Path: []string{"cursor"}, Code: "invalid_cursor", Message: err.Error()}}}
	}
	if limit <= 0 {
		limit = defaultLogLimit
	}

	job, err := m.job(ctx, kube.BuildName(runID))
	if err != nil {
		return nil, "", err
	}
	pod := m.latestPod(job)
	if pod == nil || pod.Status.Phase == corev1.PodPending {
		return []LogLine{}, cursor.String(), nil
	}

	opts := &corev1.PodLogOptions{Container: containerName, Timestamps: true}
	if since := cursor.SinceTime(); since != nil {
		opts.SinceTime = ptr.To(metav1.NewTime(*since))
	}
	stream, err := m.cluster.Kube.CoreV1().Pods(m.namespace()).GetLogs(pod.Name, opts).Stream(ctx)
	if apierrors.IsNotFound(err) || apierrors.IsBadRequest(err) {
		return []LogLine{}, cursor.String(), nil
	}
	if err != nil {
		return nil, "", fmt.Errorf("read build logs: %w", err)
	}
	defer stream.Close()

	lines, next, err := ReadLines(stream, cursor, limit)
	if err != nil && len(lines) == 0 {
		return nil, "", err
	}
	return lines, next.String(), nil
}

func (m *Manager) Delete(ctx context.Context, runID string) error {
	name := kube.BuildName(runID)
	opts := metav1.DeleteOptions{PropagationPolicy: ptr.To(metav1.DeletePropagationBackground)}

	err := m.cluster.Kube.BatchV1().Jobs(m.namespace()).Delete(ctx, name, opts)
	if err != nil && !apierrors.IsNotFound(err) {
		return err
	}
	err = m.cluster.Kube.CoreV1().Secrets(m.namespace()).Delete(ctx, name, opts)
	if err != nil && !apierrors.IsNotFound(err) {
		return err
	}
	return nil
}

// ResolvePod maps an authenticated build pod to its running Job and declared spec.
func (m *Manager) ResolvePod(ctx context.Context, podName, podUID string) (*batchv1.Job, *BuildSpec, error) {
	pod, ok := m.cache.BuildPod(podName)
	if !ok {
		var err error
		pod, err = m.cluster.Kube.CoreV1().Pods(m.namespace()).Get(ctx, podName, metav1.GetOptions{})
		if err != nil {
			return nil, nil, ErrPodUnknown
		}
	}
	if podUID == "" || string(pod.UID) != podUID {
		return nil, nil, ErrPodUnknown
	}

	owner := metav1.GetControllerOf(pod)
	if owner == nil || owner.Kind != "Job" {
		return nil, nil, ErrPodUnknown
	}
	job, err := m.job(ctx, owner.Name)
	if err != nil {
		return nil, nil, ErrPodUnknown
	}
	runID := job.Labels[kube.LabelBuildID]
	if job.UID != owner.UID || runID == "" || job.DeletionTimestamp != nil {
		return nil, nil, ErrPodUnknown
	}
	if finished, _ := kube.JobFinished(job); finished {
		return nil, nil, ErrBuildFinished
	}

	secret, err := m.cluster.Kube.CoreV1().Secrets(m.namespace()).Get(ctx, job.Name, metav1.GetOptions{})
	if err != nil {
		return nil, nil, fmt.Errorf("read build spec: %w", err)
	}
	var spec BuildSpec
	if err := json.Unmarshal(secret.Data[SecretKeySpec], &spec); err != nil || spec.RunID != runID {
		return nil, nil, fmt.Errorf("build spec of %s is invalid", job.Name)
	}
	return job, &spec, nil
}

func (m *Manager) RecordUpload(ctx context.Context, job *batchv1.Job, stepID string, size int64) error {
	value, _ := json.Marshal(uploadRecord{StepID: stepID, At: m.now().UTC(), SizeBytes: size})
	patch, _ := json.Marshal(map[string]any{"metadata": map[string]any{"annotations": map[string]string{
		kube.UploadAnnotation(stepID): string(value),
	}}})
	_, err := m.cluster.Kube.BatchV1().Jobs(m.namespace()).Patch(ctx, job.Name, types.MergePatchType, patch, metav1.PatchOptions{FieldManager: kube.ManagedBy})
	return err
}

func (m *Manager) DryRun(ctx context.Context) error {
	secret, job, err := m.Prepare(&StartRequest{
		RunID:          "preflight",
		Image:          "build-ubuntu",
		Script:         "true",
		Env:            map[string]string{"EXAMPLE": "1"},
		TimeoutSeconds: 600,
		EgressGrant:    "preflight",
	})
	if err != nil {
		return err
	}

	dryRun := metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}}
	if _, err := m.cluster.Kube.CoreV1().Secrets(m.namespace()).Create(ctx, secret, dryRun); err != nil && !apierrors.IsAlreadyExists(err) {
		return err
	}
	_, err = m.cluster.Kube.BatchV1().Jobs(m.namespace()).Create(ctx, job, dryRun)
	return err
}

func (m *Manager) SweepOrphanSecrets(ctx context.Context) error {
	selector := labels.SelectorFromSet(labels.Set{kube.LabelComponent: kube.ComponentBuild, kube.LabelManagedBy: kube.ManagedBy}).String()
	secrets, err := m.cluster.Kube.CoreV1().Secrets(m.namespace()).List(ctx, metav1.ListOptions{LabelSelector: selector})
	if err != nil {
		return err
	}

	for _, secret := range secrets.Items {
		if len(secret.OwnerReferences) > 0 || m.now().Sub(secret.CreationTimestamp.Time) < orphanSecretAge {
			continue
		}
		if _, err := m.job(ctx, secret.Name); err == nil {
			continue
		}
		err := m.cluster.Kube.CoreV1().Secrets(m.namespace()).Delete(ctx, secret.Name, metav1.DeleteOptions{
			Preconditions: &metav1.Preconditions{UID: &secret.UID},
		})
		if err != nil && !apierrors.IsNotFound(err) && !apierrors.IsConflict(err) {
			return err
		}
		m.log.Info("deleted orphaned build secret", "name", secret.Name)
	}
	return nil
}
