package pullsecret

import (
	"context"
	"log/slog"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func newSyncer(t *testing.T, secretData string) (*Syncer, *fake.Clientset) {
	t.Helper()
	client := fake.NewSimpleClientset(
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{Name: "metorial-registry", Namespace: "metorial"},
			Type:       corev1.SecretTypeDockerConfigJson,
			Data:       map[string][]byte{corev1.DockerConfigJsonKey: []byte(secretData)},
		},
		&corev1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Name: "function-runtime", Namespace: "fns"}},
		&corev1.ServiceAccount{
			ObjectMeta:       metav1.ObjectMeta{Name: "build-runtime", Namespace: "builds"},
			ImagePullSecrets: []corev1.LocalObjectReference{{Name: "other"}},
		},
	)
	return &Syncer{
		Source:          client,
		SourceNamespace: "metorial",
		SecretName:      "metorial-registry",
		Targets: []Target{
			{Client: client, Namespace: "fns", ServiceAccount: "function-runtime"},
			{Client: client, Namespace: "builds", ServiceAccount: "build-runtime"},
		},
		Interval: time.Minute,
		Log:      slog.Default(),
	}, client
}

func TestSyncCopiesSecretAndPatchesServiceAccounts(t *testing.T) {
	s, client := newSyncer(t, `{"auths":{}}`)
	ctx := context.Background()

	if len(s.Verify(ctx)) == 0 {
		t.Fatal("verify should report the unpatched ServiceAccounts")
	}
	if err := s.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	if problems := s.Verify(ctx); len(problems) != 0 {
		t.Fatalf("problems after sync: %v", problems)
	}

	sa, _ := client.CoreV1().ServiceAccounts("builds").Get(ctx, "build-runtime", metav1.GetOptions{})
	if len(sa.ImagePullSecrets) != 2 {
		t.Fatalf("existing pull secrets must be kept: %v", sa.ImagePullSecrets)
	}
}

func TestSyncPropagatesRotation(t *testing.T) {
	s, client := newSyncer(t, `{"auths":{}}`)
	ctx := context.Background()
	if err := s.Sync(ctx); err != nil {
		t.Fatal(err)
	}

	source, _ := client.CoreV1().Secrets("metorial").Get(ctx, "metorial-registry", metav1.GetOptions{})
	source.Data[corev1.DockerConfigJsonKey] = []byte(`{"auths":{"new":{}}}`)
	if _, err := client.CoreV1().Secrets("metorial").Update(ctx, source, metav1.UpdateOptions{}); err != nil {
		t.Fatal(err)
	}
	if err := s.Sync(ctx); err != nil {
		t.Fatal(err)
	}

	copied, _ := client.CoreV1().Secrets("fns").Get(ctx, "metorial-registry", metav1.GetOptions{})
	if string(copied.Data[corev1.DockerConfigJsonKey]) != `{"auths":{"new":{}}}` {
		t.Fatalf("rotation was not copied: %s", copied.Data[corev1.DockerConfigJsonKey])
	}
}

func TestSyncRejectsWrongSecretType(t *testing.T) {
	s, client := newSyncer(t, "")
	ctx := context.Background()
	source, _ := client.CoreV1().Secrets("metorial").Get(ctx, "metorial-registry", metav1.GetOptions{})
	source.Type = corev1.SecretTypeOpaque
	_, _ = client.CoreV1().Secrets("metorial").Update(ctx, source, metav1.UpdateOptions{})
	if err := s.Sync(ctx); err == nil {
		t.Fatal("expected an error for a non-dockerconfigjson Secret")
	}
}
