package preflight

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/netip"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	authenticationv1 "k8s.io/api/authentication/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	utilrand "k8s.io/apimachinery/pkg/util/rand"
	"k8s.io/utils/ptr"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/auth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/config"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/kube"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/metrics"
)

const (
	knativeNamespace   = "knative-serving"
	maxFunctionTimeout = 900
	probeTimeout       = 2 * time.Minute
	iptablesSafeCap    = 1000
	probeJobName       = "runtime-preflight-netpol"
	probeSettleSeconds = 5
)

type Status string

const (
	StatusPass Status = "pass"
	StatusWarn Status = "warn"
	StatusFail Status = "fail"
	StatusSkip Status = "skip"
)

type Result struct {
	Check   string `json:"check"`
	Status  Status `json:"status"`
	Message string `json:"message"`
}

type Report struct {
	Results      []Result `json:"results"`
	ClusterCIDRs []string `json:"clusterCidrs"`
	CheckedAt    string   `json:"checkedAt"`
}

func (r *Report) Failed() []Result {
	var failed []Result
	for _, res := range r.Results {
		if res.Status == StatusFail {
			failed = append(failed, res)
		}
	}
	return failed
}

type Runner struct {
	Config         *config.Config
	Platform       *kube.Cluster
	Functions      *kube.Cluster
	ControlAuth    *auth.Authenticator
	PodAuth        *auth.Authenticator
	DryRunFunction func(ctx context.Context) error
	DryRunBuild    func(ctx context.Context) error
	Metrics        *metrics.Metrics
	Log            *slog.Logger
}

func (r *Runner) Run(ctx context.Context) *Report {
	report := &Report{CheckedAt: time.Now().UTC().Format(time.RFC3339)}
	add := func(check string, status Status, format string, args ...any) {
		res := Result{Check: check, Status: status, Message: fmt.Sprintf(format, args...)}
		report.Results = append(report.Results, res)
		r.Metrics.PreflightResults.WithLabelValues(check, string(status)).Set(1)

		level := slog.LevelInfo
		switch status {
		case StatusWarn:
			level = slog.LevelWarn
		case StatusFail:
			level = slog.LevelError
		}
		r.Log.Log(ctx, level, "preflight", "check", check, "status", status, "message", res.Message)
	}

	r.knative(ctx, add)
	r.runtimeClasses(ctx, add)
	r.tokenReview(ctx, add)
	r.dryRuns(ctx, add)
	r.networkPolicy(ctx, add)
	report.ClusterCIDRs = r.clusterCIDRs(ctx, add)
	r.kubeProxy(ctx, add)
	return report
}

type addFunc func(check string, status Status, format string, args ...any)

func (r *Runner) knative(ctx context.Context, add addFunc) {
	cms := r.Functions.Kube.CoreV1().ConfigMaps(knativeNamespace)

	features, err := cms.Get(ctx, "config-features", metav1.GetOptions{})
	if err != nil {
		add("knative.installed", StatusFail, "cannot read %s/config-features: %v", knativeNamespace, err)
		return
	}

	version := features.Labels["app.kubernetes.io/version"]
	switch {
	case version == "":
		add("knative.version", StatusWarn, "cannot determine the Knative Serving version")
	case compareVersions(version, r.Config.PreflightMinKnativeVersion) < 0:
		add("knative.version", StatusFail, "Knative Serving %s is older than the supported minimum %s", version, r.Config.PreflightMinKnativeVersion)
	default:
		add("knative.version", StatusPass, "Knative Serving %s", version)
	}

	for _, flag := range []string{"kubernetes.podspec-runtimeclassname", "kubernetes.podspec-volumes-emptydir", "secure-pod-defaults"} {
		if value := features.Data[flag]; value != "enabled" {
			add("knative.features."+flag, StatusFail, "config-features %s is %q, must be \"enabled\"", flag, value)
		} else {
			add("knative.features."+flag, StatusPass, "enabled")
		}
	}

	autoscaler, err := cms.Get(ctx, "config-autoscaler", metav1.GetOptions{})
	if err != nil || autoscaler.Data["allow-zero-initial-scale"] != "true" {
		add("knative.allow-zero-initial-scale", StatusFail, "config-autoscaler allow-zero-initial-scale must be \"true\"")
	} else {
		add("knative.allow-zero-initial-scale", StatusPass, "true")
	}

	required := maxFunctionTimeout + int(r.Config.BootAllowance.Seconds())
	defaults, err := cms.Get(ctx, "config-defaults", metav1.GetOptions{})
	if err != nil {
		add("knative.max-revision-timeout", StatusFail, "cannot read config-defaults: %v", err)
		return
	}
	maxTimeout, err := strconv.Atoi(defaults.Data["max-revision-timeout-seconds"])
	if err != nil {
		maxTimeout = 600
	}
	if maxTimeout < required {
		add("knative.max-revision-timeout", StatusFail, "config-defaults max-revision-timeout-seconds is %d, needs at least %d", maxTimeout, required)
	} else {
		add("knative.max-revision-timeout", StatusPass, "%d seconds", maxTimeout)
	}
}

func (r *Runner) runtimeClasses(ctx context.Context, add addFunc) {
	classes := map[string]bool{}
	for _, name := range []string{r.Config.RuncRuntimeClass, r.Config.GVisorRuntimeClass} {
		if name != "" {
			classes[name] = true
		}
	}
	if len(classes) == 0 {
		add("runtimeclasses", StatusPass, "no RuntimeClasses configured; pods use the cluster default runtime")
		return
	}

	clusters := []*kube.Cluster{r.Platform}
	if r.Functions != r.Platform {
		clusters = append(clusters, r.Functions)
	}
	for name := range classes {
		for _, cluster := range clusters {
			if _, err := cluster.Kube.NodeV1().RuntimeClasses().Get(ctx, name, metav1.GetOptions{}); err != nil {
				add("runtimeclasses."+name, StatusFail, "RuntimeClass %s: %v", name, err)
				return
			}
		}
		add("runtimeclasses."+name, StatusPass, "exists")
	}
}

func (r *Runner) tokenReview(ctx context.Context, add addFunc) {
	sa := r.Platform.Kube.CoreV1().ServiceAccounts(r.Config.PlatformNamespace)
	mint := func(audience string) (string, error) {
		res, err := sa.CreateToken(ctx, r.Config.SelfServiceAccount, &authenticationv1.TokenRequest{
			Spec: authenticationv1.TokenRequestSpec{Audiences: []string{audience}, ExpirationSeconds: ptr.To(int64(600))},
		}, metav1.CreateOptions{})
		if err != nil {
			return "", err
		}
		return res.Status.Token, nil
	}

	controlToken, err := mint(r.Config.ControlAudience)
	if err != nil {
		add("tokenreview", StatusFail, "cannot mint a test token for %s/%s: %v", r.Config.PlatformNamespace, r.Config.SelfServiceAccount, err)
		return
	}
	podToken, err := mint(r.Config.PodAudience)
	if err != nil {
		add("tokenreview", StatusFail, "cannot mint a test token: %v", err)
		return
	}

	// The cluster-manager's own ServiceAccount isn't on the control allowlist, so a working review
	// of a control-audience token ends in 403, not 401.
	if _, err := r.ControlAuth.Verify(ctx, controlToken); statusOf(err) != 403 {
		add("tokenreview.control", StatusFail, "expected the control audience to authenticate and reject a non-allowlisted caller, got %v", err)
		return
	}
	if _, err := r.PodAuth.Verify(ctx, podToken); err != nil {
		add("tokenreview.pod", StatusFail, "a pod-audience token was rejected: %v", err)
		return
	}
	if _, err := r.ControlAuth.Verify(ctx, podToken); statusOf(err) != 401 {
		add("tokenreview.audience", StatusFail, "a pod-audience token was not rejected by the control listener: %v", err)
		return
	}
	add("tokenreview", StatusPass, "TokenReview works and audiences are separated")
}

func statusOf(err error) int {
	if e, ok := ldrpc.AsError(err); ok {
		return e.Status
	}
	if err == nil {
		return 200
	}
	return 500
}

func (r *Runner) dryRuns(ctx context.Context, add addFunc) {
	if err := r.DryRunFunction(ctx); err != nil {
		add("dryrun.function", StatusFail, "server-side dry run of a rendered Knative Service failed: %v", err)
	} else {
		add("dryrun.function", StatusPass, "accepted")
	}
	if err := r.DryRunBuild(ctx); err != nil {
		add("dryrun.build", StatusFail, "server-side dry run of a rendered build Job failed: %v", err)
	} else {
		add("dryrun.build", StatusPass, "accepted")
	}
}

func (r *Runner) probeTarget(ctx context.Context) (string, error) {
	if r.Config.PreflightProbeTarget != "" {
		return r.Config.PreflightProbeTarget, nil
	}
	if host, port := os.Getenv("KUBERNETES_SERVICE_HOST"), os.Getenv("KUBERNETES_SERVICE_PORT"); host != "" && port != "" {
		return net.JoinHostPort(host, port), nil
	}
	svc, err := r.Platform.Kube.CoreV1().Services("default").Get(ctx, "kubernetes", metav1.GetOptions{})
	if err != nil {
		return "", err
	}
	return net.JoinHostPort(svc.Spec.ClusterIP, "443"), nil
}

// networkPolicy runs a Job in the builds namespace that tries to open a connection the runtime
// NetworkPolicies must deny. The Job succeeds only if the connection fails.
func (r *Runner) networkPolicy(ctx context.Context, add addFunc) {
	if !r.Config.PreflightNetworkPolicyProbe {
		add("networkpolicy", StatusSkip, "probe disabled (CLUSTER_MANAGER_PREFLIGHT_NETWORK_POLICY_PROBE=false)")
		return
	}
	target, err := r.probeTarget(ctx)
	if err != nil {
		add("networkpolicy", StatusFail, "cannot determine a probe target: %v", err)
		return
	}
	host, port, err := net.SplitHostPort(target)
	if err != nil {
		add("networkpolicy", StatusFail, "invalid probe target %q: %v", target, err)
		return
	}

	jobs := r.Platform.Kube.BatchV1().Jobs(r.Config.BuildsNamespace)
	background := metav1.DeleteOptions{PropagationPolicy: ptr.To(metav1.DeletePropagationBackground)}
	name := probeJobName + "-" + utilrand.String(8)
	defer func() { _ = jobs.Delete(context.WithoutCancel(ctx), name, background) }()

	// CNIs program NetworkPolicy for a new pod asynchronously (OrbStack: ~200 ms after start), so
	// connecting immediately would report enforcement as missing.
	script := fmt.Sprintf("sleep %d; if timeout 5 bash -c '</dev/tcp/%s/%s'; then echo reachable; exit 1; fi; echo blocked", probeSettleSeconds, host, port)
	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:   name,
			Labels: map[string]string{kube.LabelComponent: kube.ComponentPreflight, kube.LabelManagedBy: kube.ManagedBy},
		},
		Spec: batchv1.JobSpec{
			BackoffLimit:            ptr.To(int32(0)),
			ActiveDeadlineSeconds:   ptr.To(int64(probeTimeout.Seconds())),
			TTLSecondsAfterFinished: ptr.To(int32(300)),
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{kube.LabelComponent: kube.ComponentPreflight}},
				Spec: corev1.PodSpec{
					RestartPolicy:                corev1.RestartPolicyNever,
					ServiceAccountName:           r.Config.BuildRuntimeSA,
					AutomountServiceAccountToken: ptr.To(false),
					EnableServiceLinks:           ptr.To(false),
					Containers: []corev1.Container{{
						Name:    "probe",
						Image:   r.Config.BuildImage,
						Command: []string{"/bin/bash", "-c", script},
						SecurityContext: &corev1.SecurityContext{
							AllowPrivilegeEscalation: ptr.To(false),
							SeccompProfile:           &corev1.SeccompProfile{Type: corev1.SeccompProfileTypeRuntimeDefault},
						},
					}},
				},
			},
		},
	}
	if _, err := jobs.Create(ctx, job, metav1.CreateOptions{}); err != nil {
		add("networkpolicy", StatusFail, "cannot create the probe Job: %v", err)
		return
	}

	waitCtx, cancel := context.WithTimeout(ctx, probeTimeout+30*time.Second)
	defer cancel()
	for {
		current, err := jobs.Get(waitCtx, name, metav1.GetOptions{})
		if err == nil {
			if finished, succeeded := kube.JobFinished(current); finished {
				switch output := r.probeOutput(ctx, name); {
				case succeeded:
					add("networkpolicy", StatusPass, "a build pod could not reach %s", target)
				case strings.Contains(output, "reachable"):
					add("networkpolicy", StatusFail, "NetworkPolicy is not enforced: a build pod in %s reached %s", r.Config.BuildsNamespace, target)
				default:
					add("networkpolicy", StatusFail, "the probe Job failed without a result: %s", output)
				}
				return
			}
		}
		select {
		case <-waitCtx.Done():
			add("networkpolicy", StatusFail, "the probe Job did not finish in time")
			return
		case <-time.After(2 * time.Second):
		}
	}
}

func (r *Runner) probeOutput(ctx context.Context, jobName string) string {
	pods := r.Platform.Kube.CoreV1().Pods(r.Config.BuildsNamespace)
	list, err := pods.List(ctx, metav1.ListOptions{LabelSelector: "job-name=" + jobName})
	if err != nil || len(list.Items) == 0 {
		return "no probe pod found"
	}
	pod := list.Items[0]
	raw, err := pods.GetLogs(pod.Name, &corev1.PodLogOptions{TailLines: ptr.To(int64(5))}).DoRaw(ctx)
	if err != nil || len(raw) == 0 {
		return fmt.Sprintf("pod phase %s, no output", pod.Status.Phase)
	}
	return strings.TrimSpace(string(raw))
}

func (r *Runner) clusterCIDRs(ctx context.Context, add addFunc) []string {
	if len(r.Config.ClusterCIDRs) > 0 {
		out := make([]string, len(r.Config.ClusterCIDRs))
		for i, p := range r.Config.ClusterCIDRs {
			out[i] = p.String()
		}
		add("cluster-cidrs", StatusPass, "configured: %s", strings.Join(out, ", "))
		return out
	}

	cidrs, err := DetectClusterCIDRs(ctx, r.Functions)
	if err != nil {
		add("cluster-cidrs", StatusFail, "%v; set CLUSTER_MANAGER_CLUSTER_CIDRS", err)
		return nil
	}
	if r.Platform != r.Functions {
		more, err := DetectClusterCIDRs(ctx, r.Platform)
		if err != nil {
			add("cluster-cidrs", StatusFail, "platform cluster: %v; set CLUSTER_MANAGER_CLUSTER_CIDRS", err)
			return nil
		}
		cidrs = dedupe(append(cidrs, more...))
	}
	add("cluster-cidrs", StatusPass, "detected: %s", strings.Join(cidrs, ", "))
	return cidrs
}

// DetectClusterCIDRs collects Service CIDRs (networking.k8s.io/v1 ServiceCIDR), node pod CIDRs and
// node addresses. It fails when either Service or pod ranges can't be found.
func DetectClusterCIDRs(ctx context.Context, cluster *kube.Cluster) ([]string, error) {
	var cidrs []string

	serviceCIDRs, err := cluster.Kube.NetworkingV1().ServiceCIDRs().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("cannot list ServiceCIDRs: %w", err)
	}
	for _, sc := range serviceCIDRs.Items {
		cidrs = append(cidrs, sc.Spec.CIDRs...)
	}
	if len(cidrs) == 0 {
		return nil, errors.New("no Service CIDR found")
	}

	nodes, err := cluster.Kube.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("cannot list nodes: %w", err)
	}
	podRanges := 0
	for _, node := range nodes.Items {
		for _, cidr := range node.Spec.PodCIDRs {
			cidrs = append(cidrs, cidr)
			podRanges++
		}
		for _, addr := range node.Status.Addresses {
			if addr.Type != corev1.NodeInternalIP && addr.Type != corev1.NodeExternalIP {
				continue
			}
			if ip, err := netip.ParseAddr(addr.Address); err == nil {
				cidrs = append(cidrs, netip.PrefixFrom(ip, ip.BitLen()).String())
			}
		}
	}
	if podRanges == 0 {
		return nil, errors.New("nodes don't report pod CIDRs (the CNI manages IPAM itself)")
	}
	return dedupe(cidrs), nil
}

func dedupe(in []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, s := range in {
		if p, err := netip.ParsePrefix(s); err == nil {
			s = p.Masked().String()
		}
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	sort.Strings(out)
	return out
}

func (r *Runner) kubeProxy(ctx context.Context, add addFunc) {
	cm, err := r.Functions.Kube.CoreV1().ConfigMaps("kube-system").Get(ctx, "kube-proxy", metav1.GetOptions{})
	if apierrors.IsNotFound(err) || apierrors.IsForbidden(err) {
		add("kube-proxy", StatusSkip, "kube-proxy configuration not readable; cannot check the materialization cap against its mode")
		return
	}
	if err != nil {
		add("kube-proxy", StatusSkip, "cannot read kube-proxy configuration: %v", err)
		return
	}

	mode := "iptables"
	for line := range strings.SplitSeq(cm.Data["config.conf"], "\n") {
		if value, ok := strings.CutPrefix(strings.TrimSpace(line), "mode:"); ok {
			if value = strings.Trim(strings.TrimSpace(value), `"'`); value != "" {
				mode = value
			}
		}
	}
	if mode == "iptables" && r.Config.MaxMaterialized > iptablesSafeCap {
		add("kube-proxy", StatusWarn, "kube-proxy runs in iptables mode; CLUSTER_MANAGER_MAX_MATERIALIZED=%d exceeds the recommended %d", r.Config.MaxMaterialized, iptablesSafeCap)
		return
	}
	if mode == "ipvs" {
		add("kube-proxy", StatusWarn, "kube-proxy's IPVS mode is deprecated; use nftables")
		return
	}
	add("kube-proxy", StatusPass, "mode %s", mode)
}

func compareVersions(a, b string) int {
	pa, pb := versionParts(a), versionParts(b)
	for i := range 3 {
		if pa[i] != pb[i] {
			if pa[i] < pb[i] {
				return -1
			}
			return 1
		}
	}
	return 0
}

func versionParts(v string) [3]int {
	var out [3]int
	v = strings.TrimPrefix(strings.TrimPrefix(v, "knative-"), "v")
	for i, part := range strings.SplitN(v, ".", 3) {
		if idx := strings.IndexFunc(part, func(r rune) bool { return r < '0' || r > '9' }); idx >= 0 {
			part = part[:idx]
		}
		out[i], _ = strconv.Atoi(part)
	}
	return out
}
