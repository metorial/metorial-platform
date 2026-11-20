package doctorchecks

import (
	"context"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	doctor "github.com/metorial/metorial-platform/src/lib/doctor/go"
	authorizationv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/preflight"
)

const (
	component             = "cluster-manager"
	preflightRefresh      = 15 * time.Minute
	imageEventWindow      = 15 * time.Minute
	materializedWarnRatio = 0.9
	quotaWarnRatio        = 0.9
	certificateWarnWindow = 14 * 24 * time.Hour
	docs                  = "datacenter/operations/doctor#cluster-manager"
)

// The preflight groups, in run order. A group's result is the worst of the results named after it
// (`knative`, `knative.version`, ...), since the sub-check names depend on the cluster.
var preflightGroups = []struct {
	name     string
	title    string
	severity doctor.Severity
}{
	{"knative", "Knative Serving is installed and configured", doctor.SeverityCritical},
	{"runtimeclasses", "The configured RuntimeClasses exist", doctor.SeverityCritical},
	{"tokenreview", "TokenReview authenticates pods and callers", doctor.SeverityCritical},
	{"dryrun", "Functions and builds pass a server-side dry run", doctor.SeverityCritical},
	{"networkpolicy", "NetworkPolicy is enforced for build pods", doctor.SeverityCritical},
	{"cluster-cidrs", "The cluster CIDRs are known", doctor.SeverityCritical},
	{"kube-proxy", "kube-proxy suits the materialization cap", doctor.SeverityWarning},
}

type Permission struct {
	Cluster   kubernetes.Interface
	Namespace string
	Group     string
	Resource  string
	Verb      string
}

type Options struct {
	Preflight        *Preflight
	ObjectStorageURL string
	EgressGateway    string
	NetworkLogs      string
	TLSCertFile      string
	QuotaNamespaces  map[string]kubernetes.Interface
	Permissions      []Permission
	EventNamespaces  map[string]kubernetes.Interface
	Counts           func() (materialized, warm int)
	MaxMaterialized  int
}

// Preflight keeps the latest preflight report. Checks read it without waiting and start a rerun in
// the background once it is older than the refresh interval, because a full run (probe Job, dry
// runs) takes far longer than a doctor run may.
type Preflight struct {
	run      func(ctx context.Context) *preflight.Report
	onReport func(*preflight.Report)

	mu         sync.Mutex
	report     *preflight.Report
	finishedAt time.Time
	running    bool
}

func NewPreflight(initial *preflight.Report, run func(ctx context.Context) *preflight.Report, onReport func(*preflight.Report)) *Preflight {
	return &Preflight{run: run, onReport: onReport, report: initial, finishedAt: time.Now()}
}

func (p *Preflight) latest() *preflight.Report {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.run != nil && !p.running && time.Since(p.finishedAt) > preflightRefresh {
		p.running = true
		go p.refresh()
	}

	return p.report
}

func (p *Preflight) refresh() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	report := p.run(ctx)

	p.mu.Lock()
	p.report, p.finishedAt, p.running = report, time.Now(), false
	p.mu.Unlock()

	if p.onReport != nil {
		p.onReport(report)
	}
}

func New(options Options) (*doctor.Doctor, error) {
	d := doctor.New(doctor.Options{Component: component})
	if err := d.Register(Checks(options)...); err != nil {
		return nil, err
	}

	return d, nil
}

func preflightChecks(source *Preflight) []doctor.Check {
	checks := []doctor.Check{}
	for _, group := range preflightGroups {
		checks = append(checks, preflightCheck(source, group.name, group.title, group.severity))
	}
	return checks
}

// NewPreflightOnly serves just the preflight results, for a cluster-manager that refuses to start
// but should still tell the operator why.
func NewPreflightOnly(source *Preflight) (*doctor.Doctor, error) {
	d := doctor.New(doctor.Options{Component: component})
	if err := d.Register(preflightChecks(source)...); err != nil {
		return nil, err
	}

	return d, nil
}

func Checks(options Options) []doctor.Check {
	checks := preflightChecks(options.Preflight)

	checks = append(checks,
		permissionsCheck(options.Permissions),
		objectStorageCheck(options.ObjectStorageURL),
		egressGatewayCheck(options.EgressGateway),
		networkLogsCheck(options.NetworkLogs),
		quotaCheck(options.QuotaNamespaces),
		certificatesCheck(options.TLSCertFile),
		imagesCheck(options.EventNamespaces),
		materializedCheck(options.Counts, options.MaxMaterialized),
	)

	return checks
}

func resolution(summary string, steps ...string) *doctor.Resolution {
	link := docs
	return &doctor.Resolution{Summary: summary, Steps: steps, Docs: &link}
}

func inGroup(check, group string) bool {
	return check == group || strings.HasPrefix(check, group+".")
}

func preflightCheck(source *Preflight, group, title string, severity doctor.Severity) doctor.Check {
	return doctor.Check{
		ID:       "preflight." + group,
		Title:    title,
		Category: doctor.CategoryRuntime,
		Severity: severity,
		Target:   "kubernetes",
		Run: func(_ context.Context, r *doctor.Result) error {
			if source == nil {
				r.Skip("Preflight is off (CLUSTER_MANAGER_PREFLIGHT=off).", nil)
				return nil
			}

			report := source.latest()
			if report == nil {
				r.Skip("Preflight has not run yet.", nil)
				return nil
			}

			var failed, warned, passed []string
			results := []map[string]any{}
			for _, result := range report.Results {
				if !inGroup(result.Check, group) {
					continue
				}

				line := result.Check + ": " + result.Message
				results = append(results, map[string]any{"check": result.Check, "status": result.Status, "message": result.Message})
				switch result.Status {
				case preflight.StatusFail:
					failed = append(failed, line)
				case preflight.StatusWarn:
					warned = append(warned, line)
				case preflight.StatusPass:
					passed = append(passed, line)
				}
			}

			details := map[string]any{"checkedAt": report.CheckedAt, "results": results}
			fix := resolution("Fix the reported cluster setting; preflight runs again within 15 minutes, or restart cluster-manager.")

			switch {
			case len(failed) > 0:
				r.Fail(strings.Join(failed, "; "), fix, details)
			case len(warned) > 0:
				r.Warn(strings.Join(warned, "; "), fix, details)
			case len(passed) > 0:
				r.Pass(strings.Join(passed, "; "), details)
			case len(results) > 0:
				r.Skip(fmt.Sprint(results[0]["message"]), details)
			default:
				r.Skip("Preflight reported nothing for this group.", details)
			}
			return nil
		},
	}
}

func permissionsCheck(permissions []Permission) doctor.Check {
	return doctor.Check{
		ID:       "kube.permissions",
		Title:    "The service account has the runtime permissions",
		Category: doctor.CategorySecurity,
		Severity: doctor.SeverityCritical,
		Target:   "kubernetes",
		Timeout:  10 * time.Second,
		Run: func(ctx context.Context, r *doctor.Result) error {
			missing := []string{}
			for _, permission := range permissions {
				review := &authorizationv1.SelfSubjectAccessReview{
					Spec: authorizationv1.SelfSubjectAccessReviewSpec{
						ResourceAttributes: &authorizationv1.ResourceAttributes{
							Namespace: permission.Namespace,
							Group:     permission.Group,
							Resource:  permission.Resource,
							Verb:      permission.Verb,
						},
					},
				}

				response, err := permission.Cluster.AuthorizationV1().SelfSubjectAccessReviews().Create(ctx, review, metav1.CreateOptions{})
				if err != nil {
					return err
				}
				if !response.Status.Allowed {
					resource := permission.Resource
					if permission.Group != "" {
						resource += "." + permission.Group
					}
					missing = append(missing, fmt.Sprintf("%s %s in %s", permission.Verb, resource, permission.Namespace))
				}
			}

			if len(missing) > 0 {
				r.Fail("The service account may not "+strings.Join(missing, ", ")+".", resolution(
					"Apply the chart's RBAC for the runtime namespaces, or grant the missing verbs to the cluster-manager service account.",
				), map[string]any{"missing": missing})
				return nil
			}

			r.Pass(fmt.Sprintf("All %d required permissions are granted.", len(permissions)), nil)
			return nil
		},
	}
}

func objectStorageCheck(baseURL string) doctor.Check {
	return doctor.Check{
		ID:       "dependencies.object-storage",
		Title:    "object-storage is reachable",
		Category: doctor.CategoryDependency,
		Severity: doctor.SeverityCritical,
		Target:   "object-storage",
		Run:      doctor.HTTPProbe(nil, strings.TrimRight(baseURL, "/")+"/health"),
	}
}

func egressGatewayCheck(address string) doctor.Check {
	return doctor.Check{
		ID:       "dependencies.egress-gateway",
		Title:    "The egress gateway is reachable",
		Category: doctor.CategoryDependency,
		Severity: doctor.SeverityCritical,
		Target:   "egress-gateway",
		Run: func(ctx context.Context, r *doctor.Result) error {
			if address == "" {
				r.Skip("No egress gateway is configured.", nil)
				return nil
			}
			return doctor.TCPProbe(address)(ctx, r)
		},
	}
}

func imagesCheck(namespaces map[string]kubernetes.Interface) doctor.Check {
	return doctor.Check{
		ID:       "runtime.images",
		Title:    "Runtime pods can pull their images",
		Category: doctor.CategoryRuntime,
		Severity: doctor.SeverityCritical,
		Target:   "kubernetes",
		Timeout:  10 * time.Second,
		Run: func(ctx context.Context, r *doctor.Result) error {
			since := time.Now().Add(-imageEventWindow)
			failures := map[string]string{}

			for namespace, cluster := range namespaces {
				events, err := cluster.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{FieldSelector: "type=Warning"})
				if err != nil {
					return err
				}

				for _, event := range events.Items {
					seen := event.LastTimestamp.Time
					if seen.IsZero() {
						seen = event.EventTime.Time
					}
					if seen.Before(since) {
						continue
					}
					if strings.Contains(event.Message, "ErrImagePull") || strings.Contains(event.Message, "ImagePullBackOff") ||
						(event.Reason == "Failed" && strings.Contains(event.Message, "pull")) {
						failures[namespace+"/"+event.InvolvedObject.Name] = event.Message
					}
				}
			}

			if len(failures) > 0 {
				r.Fail(fmt.Sprintf("%d runtime pods could not pull their image in the last 15 minutes.", len(failures)), resolution(
					"Mirror the function and build images into your registry and set images.registry, or add an image pull secret.",
				), map[string]any{"pods": failures})
				return nil
			}

			r.Pass("No image pull failures in the last 15 minutes.", nil)
			return nil
		},
	}
}

func materializedCheck(counts func() (int, int), max int) doctor.Check {
	return doctor.Check{
		ID:       "functions.materialized",
		Title:    "Materialized functions stay below the cap",
		Category: doctor.CategoryRuntime,
		Severity: doctor.SeverityWarning,
		Run: func(_ context.Context, r *doctor.Result) error {
			if counts == nil || max <= 0 {
				r.Skip("No materialization cap is configured.", nil)
				return nil
			}

			materialized, warm := counts()
			details := map[string]any{"materialized": materialized, "warm": warm, "max": max}
			if float64(materialized) > float64(max)*materializedWarnRatio {
				r.Warn(fmt.Sprintf("%d of at most %d functions are materialized.", materialized, max), resolution(
					"Raise CLUSTER_MANAGER_MAX_MATERIALIZED if the cluster has room, or lower the idle TTL.",
				), details)
				return nil
			}

			r.Pass(fmt.Sprintf("%d of at most %d functions are materialized.", materialized, max), details)
			return nil
		},
	}
}

func networkLogsCheck(address string) doctor.Check {
	return doctor.Check{
		ID:       "dependencies.network-logs",
		Title:    "The network log store is reachable",
		Category: doctor.CategoryDependency,
		Severity: doctor.SeverityWarning,
		Target:   "network-logs",
		Run: func(ctx context.Context, r *doctor.Result) error {
			if address == "" {
				r.Skip("No network log store is configured.", nil)
				return nil
			}
			return doctor.TCPProbe(address)(ctx, r)
		},
	}
}

type quotaUsage struct {
	Namespace string  `json:"namespace"`
	Quota     string  `json:"quota"`
	Resource  string  `json:"resource"`
	Used      string  `json:"used"`
	Hard      string  `json:"hard"`
	Ratio     float64 `json:"ratio"`
}

func quotaCheck(namespaces map[string]kubernetes.Interface) doctor.Check {
	return doctor.Check{
		ID:       "namespaces.quota",
		Title:    "Runtime namespaces stay within their ResourceQuota",
		Category: doctor.CategoryRuntime,
		Severity: doctor.SeverityWarning,
		Target:   "kubernetes",
		Timeout:  10 * time.Second,
		Run: func(ctx context.Context, r *doctor.Result) error {
			names := make([]string, 0, len(namespaces))
			for namespace := range namespaces {
				names = append(names, namespace)
			}
			sort.Strings(names)

			quotas := 0
			near := []quotaUsage{}
			for _, namespace := range names {
				list, err := namespaces[namespace].CoreV1().ResourceQuotas(namespace).List(ctx, metav1.ListOptions{})
				if err != nil {
					return err
				}

				for _, quota := range list.Items {
					quotas++
					for resource, hard := range quota.Status.Hard {
						used, ok := quota.Status.Used[resource]
						if !ok || hard.IsZero() {
							continue
						}

						ratio := float64(used.MilliValue()) / float64(hard.MilliValue())
						if ratio > quotaWarnRatio {
							near = append(near, quotaUsage{namespace, quota.Name, string(resource), used.String(), hard.String(), ratio})
						}
					}
				}
			}

			if quotas == 0 {
				r.Skip("The runtime namespaces have no ResourceQuota.", nil)
				return nil
			}

			if len(near) > 0 {
				lines := make([]string, len(near))
				for i, item := range near {
					lines[i] = fmt.Sprintf("%s/%s %s is at %s of %s", item.Namespace, item.Quota, item.Resource, item.Used, item.Hard)
				}

				r.Warn(strings.Join(lines, "; ")+".", resolution(
					"New functions and builds are rejected once a quota is exhausted.",
					"Raise runtime.quotas for the namespace in your values and run helm upgrade, or remove unused functions.",
				), map[string]any{"usage": near})
				return nil
			}

			r.Pass(fmt.Sprintf("%d ResourceQuotas are below 90%% usage.", quotas), nil)
			return nil
		},
	}
}

func certificatesCheck(certFile string) doctor.Check {
	return doctor.Check{
		ID:       "tls.certificates",
		Title:    "The serving certificate is valid",
		Category: doctor.CategorySecurity,
		Severity: doctor.SeverityWarning,
		Target:   "tls",
		Run: func(_ context.Context, r *doctor.Result) error {
			if certFile == "" {
				r.Skip("TLS is off (runtime.tls.enabled=false).", nil)
				return nil
			}

			raw, err := os.ReadFile(certFile)
			if err != nil {
				return err
			}

			block, _ := pem.Decode(raw)
			if block == nil {
				r.Fail("The certificate file contains no PEM certificate.", resolution(
					"Check that cert-manager issued the cluster-manager certificate and the Secret is mounted.",
				), nil)
				return nil
			}

			certificate, err := x509.ParseCertificate(block.Bytes)
			if err != nil {
				return err
			}

			remaining := time.Until(certificate.NotAfter)
			details := map[string]any{"notAfter": certificate.NotAfter, "subject": certificate.Subject.String()}
			switch {
			case remaining <= 0:
				r.Warn("The certificate expired on "+certificate.NotAfter.Format(time.RFC3339)+".", resolution(
					"cert-manager has not renewed the certificate.",
					"Check the Certificate and its issuer with kubectl describe certificate, then restart cluster-manager to load the new one.",
				), details)
			case remaining < certificateWarnWindow:
				r.Warn(fmt.Sprintf("The certificate expires in %d days.", int(remaining.Hours()/24)), resolution(
					"cert-manager should renew the certificate before it expires; cluster-manager loads it at start.",
					"Check the Certificate and its issuer, then restart cluster-manager after renewal.",
				), details)
			default:
				r.Pass(fmt.Sprintf("The certificate is valid for another %d days.", int(remaining.Hours()/24)), details)
			}
			return nil
		},
	}
}
