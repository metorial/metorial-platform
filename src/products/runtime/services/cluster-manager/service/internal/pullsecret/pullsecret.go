package pullsecret

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
)

type Target struct {
	Client         kubernetes.Interface
	Namespace      string
	ServiceAccount string
}

// Syncer copies the registry pull Secret from the platform namespace into the runtime namespaces and
// lists it on the runtime ServiceAccounts, so rotating the one Secret rotates every pull.
type Syncer struct {
	Source          kubernetes.Interface
	SourceNamespace string
	SecretName      string
	Targets         []Target
	Interval        time.Duration
	Log             *slog.Logger
}

func (s *Syncer) Enabled() bool {
	return s.SecretName != ""
}

func (s *Syncer) Run(ctx context.Context) {
	if !s.Enabled() {
		return
	}
	ticker := time.NewTicker(s.Interval)
	defer ticker.Stop()
	for {
		if err := s.Sync(ctx); err != nil {
			s.Log.Warn("registry pull secret sync failed", "secret", s.SecretName, "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func (s *Syncer) Sync(ctx context.Context) error {
	source, err := s.Source.CoreV1().Secrets(s.SourceNamespace).Get(ctx, s.SecretName, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("read %s/%s: %w", s.SourceNamespace, s.SecretName, err)
	}
	if source.Type != corev1.SecretTypeDockerConfigJson || len(source.Data[corev1.DockerConfigJsonKey]) == 0 {
		return fmt.Errorf("%s/%s must be a %s Secret with a %s key", s.SourceNamespace, s.SecretName, corev1.SecretTypeDockerConfigJson, corev1.DockerConfigJsonKey)
	}

	for _, t := range s.Targets {
		if err := s.syncTarget(ctx, source, t); err != nil {
			return fmt.Errorf("%s: %w", t.Namespace, err)
		}
	}
	return nil
}

func (s *Syncer) syncTarget(ctx context.Context, source *corev1.Secret, t Target) error {
	secrets := t.Client.CoreV1().Secrets(t.Namespace)
	desired := &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:      s.SecretName,
			Namespace: t.Namespace,
			Labels:    map[string]string{"app.kubernetes.io/managed-by": "metorial-cluster-manager"},
		},
		Type: corev1.SecretTypeDockerConfigJson,
		Data: map[string][]byte{corev1.DockerConfigJsonKey: source.Data[corev1.DockerConfigJsonKey]},
	}

	existing, err := secrets.Get(ctx, s.SecretName, metav1.GetOptions{})
	switch {
	case apierrors.IsNotFound(err):
		if _, err := secrets.Create(ctx, desired, metav1.CreateOptions{}); err != nil && !apierrors.IsAlreadyExists(err) {
			return fmt.Errorf("create secret: %w", err)
		}
	case err != nil:
		return fmt.Errorf("read secret: %w", err)
	case existing.Type != desired.Type || !bytes.Equal(existing.Data[corev1.DockerConfigJsonKey], desired.Data[corev1.DockerConfigJsonKey]):
		desired.ResourceVersion = existing.ResourceVersion
		if existing.Type != desired.Type {
			if err := secrets.Delete(ctx, s.SecretName, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
				return fmt.Errorf("replace secret: %w", err)
			}
			desired.ResourceVersion = ""
			if _, err := secrets.Create(ctx, desired, metav1.CreateOptions{}); err != nil {
				return fmt.Errorf("replace secret: %w", err)
			}
		} else if _, err := secrets.Update(ctx, desired, metav1.UpdateOptions{}); err != nil {
			return fmt.Errorf("update secret: %w", err)
		}
	}

	return s.ensureServiceAccount(ctx, t)
}

func (s *Syncer) ensureServiceAccount(ctx context.Context, t Target) error {
	accounts := t.Client.CoreV1().ServiceAccounts(t.Namespace)
	sa, err := accounts.Get(ctx, t.ServiceAccount, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("read ServiceAccount %s: %w", t.ServiceAccount, err)
	}
	if listsSecret(sa.ImagePullSecrets, s.SecretName) {
		return nil
	}

	patch, err := json.Marshal(map[string]any{"imagePullSecrets": append(sa.ImagePullSecrets, corev1.LocalObjectReference{Name: s.SecretName})})
	if err != nil {
		return err
	}
	if _, err := accounts.Patch(ctx, t.ServiceAccount, types.MergePatchType, patch, metav1.PatchOptions{}); err != nil {
		return fmt.Errorf("patch ServiceAccount %s: %w", t.ServiceAccount, err)
	}
	return nil
}

// Verify reports the problems that would make pulls from the registry fail, without changing anything.
func (s *Syncer) Verify(ctx context.Context) []string {
	var problems []string
	source, err := s.Source.CoreV1().Secrets(s.SourceNamespace).Get(ctx, s.SecretName, metav1.GetOptions{})
	if err != nil {
		return []string{fmt.Sprintf("cannot read Secret %s/%s: %v", s.SourceNamespace, s.SecretName, err)}
	}
	if source.Type != corev1.SecretTypeDockerConfigJson {
		problems = append(problems, fmt.Sprintf("Secret %s/%s has type %s, must be %s", s.SourceNamespace, s.SecretName, source.Type, corev1.SecretTypeDockerConfigJson))
	}
	for _, t := range s.Targets {
		sa, err := t.Client.CoreV1().ServiceAccounts(t.Namespace).Get(ctx, t.ServiceAccount, metav1.GetOptions{})
		switch {
		case err != nil:
			problems = append(problems, fmt.Sprintf("cannot read ServiceAccount %s/%s: %v", t.Namespace, t.ServiceAccount, err))
		case !listsSecret(sa.ImagePullSecrets, s.SecretName):
			problems = append(problems, fmt.Sprintf("ServiceAccount %s/%s does not list the pull secret %s", t.Namespace, t.ServiceAccount, s.SecretName))
		}
	}
	return problems
}

func listsSecret(refs []corev1.LocalObjectReference, name string) bool {
	for _, ref := range refs {
		if ref.Name == name {
			return true
		}
	}
	return false
}
