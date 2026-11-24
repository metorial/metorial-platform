package doctorchecks

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"

	doctor "github.com/metorial/metorial-platform/src/lib/doctor/go"
	authorizationv1 "k8s.io/api/authorization/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/preflight"
)

func run(t *testing.T, checks ...doctor.Check) map[string]doctor.CheckResult {
	t.Helper()

	d := doctor.New(doctor.Options{Component: "test"})
	if err := d.Register(checks...); err != nil {
		t.Fatal(err)
	}

	report, err := d.Run(context.Background(), true)
	if err != nil {
		t.Fatal(err)
	}

	results := map[string]doctor.CheckResult{}
	for _, result := range report.Checks {
		results[result.ID] = result
	}
	return results
}

func TestPreflightGroupsTakeTheWorstResult(t *testing.T) {
	source := NewPreflight(&preflight.Report{Results: []preflight.Result{
		{Check: "knative.version", Status: preflight.StatusPass, Message: "Knative Serving 1.18"},
		{Check: "knative.features.kubernetes.podspec-runtimeclassname", Status: preflight.StatusFail, Message: "disabled"},
		{Check: "kube-proxy", Status: preflight.StatusWarn, Message: "iptables"},
		{Check: "networkpolicy", Status: preflight.StatusSkip, Message: "probe disabled"},
	}}, nil, nil)

	results := run(t,
		preflightCheck(source, "knative", "Knative", doctor.SeverityCritical),
		preflightCheck(source, "kube-proxy", "kube-proxy", doctor.SeverityWarning),
		preflightCheck(source, "networkpolicy", "NetworkPolicy", doctor.SeverityCritical),
		preflightCheck(source, "dryrun", "Dry runs", doctor.SeverityCritical),
	)

	expected := map[string]doctor.Status{
		"preflight.knative":       doctor.StatusFail,
		"preflight.kube-proxy":    doctor.StatusWarn,
		"preflight.networkpolicy": doctor.StatusSkip,
		"preflight.dryrun":        doctor.StatusSkip,
	}
	for id, status := range expected {
		if results[id].Status != status {
			t.Errorf("%s: status %s, want %s (%s)", id, results[id].Status, status, results[id].Message)
		}
	}
}

func TestPermissionsListTheMissingVerbs(t *testing.T) {
	cluster := fake.NewSimpleClientset()
	cluster.PrependReactor("create", "selfsubjectaccessreviews", func(action k8stesting.Action) (bool, runtime.Object, error) {
		review := action.(k8stesting.CreateAction).GetObject().(*authorizationv1.SelfSubjectAccessReview)
		review.Status.Allowed = review.Spec.ResourceAttributes.Verb != "delete"
		return true, review, nil
	})

	results := run(t, permissionsCheck([]Permission{
		{Cluster: cluster, Namespace: "functions", Group: "serving.knative.dev", Resource: "services", Verb: "create"},
		{Cluster: cluster, Namespace: "functions", Group: "serving.knative.dev", Resource: "services", Verb: "delete"},
	}))

	result := results["kube.permissions"]
	if result.Status != doctor.StatusFail || result.Message != "The service account may not delete services.serving.knative.dev in functions." {
		t.Fatalf("unexpected result: %s %s", result.Status, result.Message)
	}
}

func quota(name string, hard, used string) *corev1.ResourceQuota {
	return &corev1.ResourceQuota{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "functions"},
		Status: corev1.ResourceQuotaStatus{
			Hard: corev1.ResourceList{corev1.ResourceRequestsCPU: resource.MustParse(hard)},
			Used: corev1.ResourceList{corev1.ResourceRequestsCPU: resource.MustParse(used)},
		},
	}
}

func TestQuotaWarnsNearTheLimit(t *testing.T) {
	cases := []struct {
		name   string
		quotas []*corev1.ResourceQuota
		want   doctor.Status
	}{
		{"none", nil, doctor.StatusSkip},
		{"below", []*corev1.ResourceQuota{quota("q", "64", "10")}, doctor.StatusPass},
		{"near", []*corev1.ResourceQuota{quota("q", "64", "60")}, doctor.StatusWarn},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cluster := fake.NewSimpleClientset()
			for _, q := range tc.quotas {
				if _, err := cluster.CoreV1().ResourceQuotas("functions").Create(context.Background(), q, metav1.CreateOptions{}); err != nil {
					t.Fatal(err)
				}
			}

			result := run(t, quotaCheck(map[string]kubernetes.Interface{"functions": cluster}))["namespaces.quota"]
			if result.Status != tc.want {
				t.Fatalf("status %s, want %s (%s)", result.Status, tc.want, result.Message)
			}
		})
	}
}

func writeCertificate(t *testing.T, notAfter time.Time) string {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "cluster-manager"},
		NotBefore:    notAfter.Add(-90 * 24 * time.Hour),
		NotAfter:     notAfter,
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(t.TempDir(), "tls.crt")
	if err := os.WriteFile(path, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestCertificatesWarnBeforeExpiry(t *testing.T) {
	cases := []struct {
		name     string
		notAfter time.Time
		want     doctor.Status
	}{
		{"valid", time.Now().Add(60 * 24 * time.Hour), doctor.StatusPass},
		{"expiring", time.Now().Add(5 * 24 * time.Hour), doctor.StatusWarn},
		{"expired", time.Now().Add(-time.Hour), doctor.StatusWarn},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := run(t, certificatesCheck(writeCertificate(t, tc.notAfter)))["tls.certificates"]
			if result.Status != tc.want {
				t.Fatalf("status %s, want %s (%s)", result.Status, tc.want, result.Message)
			}
		})
	}

	if result := run(t, certificatesCheck(""))["tls.certificates"]; result.Status != doctor.StatusSkip {
		t.Fatalf("without TLS: status %s, want skip", result.Status)
	}

	garbage := filepath.Join(t.TempDir(), "tls.crt")
	if err := os.WriteFile(garbage, []byte("not a certificate"), 0o600); err != nil {
		t.Fatal(err)
	}
	if result := run(t, certificatesCheck(garbage))["tls.certificates"]; result.Status != doctor.StatusFail {
		t.Fatalf("garbage: status %s, want fail", result.Status)
	}
}

func TestNetworkLogsIsOptionalAndWarnsWhenDown(t *testing.T) {
	if result := run(t, networkLogsCheck(""))["dependencies.network-logs"]; result.Status != doctor.StatusSkip {
		t.Fatalf("unconfigured: status %s, want skip", result.Status)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := listener.Addr().String()

	if result := run(t, networkLogsCheck(address))["dependencies.network-logs"]; result.Status != doctor.StatusPass {
		t.Fatalf("listening: status %s, want pass", result.Status)
	}

	_ = listener.Close()
	result := run(t, networkLogsCheck(address))["dependencies.network-logs"]
	if result.Status != doctor.StatusError || result.Severity != doctor.SeverityWarning {
		t.Fatalf("closed: status %s severity %s, want a failing warning-severity check", result.Status, result.Severity)
	}
}

func TestPreflightOnlyReportsTheFailedGroups(t *testing.T) {
	source := NewPreflight(&preflight.Report{Results: []preflight.Result{
		{Check: "knative.version", Status: preflight.StatusFail, Message: "missing"},
	}}, nil, nil)

	d, err := NewPreflightOnly(source)
	if err != nil {
		t.Fatal(err)
	}
	report, err := d.Run(context.Background(), true)
	if err != nil {
		t.Fatal(err)
	}

	failed := map[string]doctor.Status{}
	for _, result := range report.Checks {
		failed[result.ID] = result.Status
	}
	if failed["preflight.knative"] != doctor.StatusFail {
		t.Errorf("preflight.knative: %s, want fail", failed["preflight.knative"])
	}
	if _, ok := failed["quota.namespaces"]; ok {
		t.Errorf("preflight-only doctor ran unrelated checks: %v", failed)
	}
}
