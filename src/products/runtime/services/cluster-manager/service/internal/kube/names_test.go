package kube

import (
	"regexp"
	"testing"

	"k8s.io/apimachinery/pkg/util/validation"
)

var namePattern = regexp.MustCompile(`^fn-[a-z2-7]{20}$`)

func TestFunctionNameIsStableAndValid(t *testing.T) {
	name := FunctionName("fver_01HZY3K8Q2W7")
	if name != FunctionName("fver_01HZY3K8Q2W7") {
		t.Fatal("name is not deterministic")
	}
	if name != "fn-i3r2q46vcrrtjem3ncdz" {
		t.Fatalf("name changed: %s", name)
	}
	if !namePattern.MatchString(name) {
		t.Fatalf("unexpected format: %s", name)
	}
	if errs := validation.IsDNS1035Label(name); len(errs) > 0 {
		t.Fatalf("not a DNS-1035 label: %v", errs)
	}
	if errs := validation.IsDNS1123Subdomain(FunctionEnvSecretName("fver_01HZY3K8Q2W7")); len(errs) > 0 {
		t.Fatalf("secret name invalid: %v", errs)
	}
}

func TestNamesDifferPerID(t *testing.T) {
	seen := map[string]string{}
	for _, id := range []string{"a", "b", "A", "fver_1", "fver_2", "fver_10", "a-very-long-version-identifier-that-exceeds-dns-label-limits-by-far"} {
		name := FunctionName(id)
		if other, ok := seen[name]; ok {
			t.Fatalf("%q and %q map to %s", id, other, name)
		}
		seen[name] = id
		if len(name) > 63 {
			t.Fatalf("%s is too long", name)
		}
	}
}

func TestBuildAndUploadNames(t *testing.T) {
	if got := BuildName("run_1"); !regexp.MustCompile(`^build-[a-z2-7]{20}$`).MatchString(got) {
		t.Fatalf("unexpected build name %s", got)
	}
	key := UploadAnnotation("step/with weird chars")
	if errs := validation.IsQualifiedName(key); len(errs) > 0 {
		t.Fatalf("upload annotation key invalid: %v", errs)
	}
}
