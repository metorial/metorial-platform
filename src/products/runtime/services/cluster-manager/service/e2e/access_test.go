package e2e

import (
	"context"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	cm "github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/clustermanagerrpc"
)

func TestControlAccess(t *testing.T) {
	e := setup(t)
	ctx := context.Background()

	stranger := &corev1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Name: "e2e-stranger", Namespace: e.platformNS}}
	if _, err := e.kube.CoreV1().ServiceAccounts(e.platformNS).Create(ctx, stranger, metav1.CreateOptions{}); err != nil && !isAlreadyExists(err) {
		t.Fatal(err)
	}

	list := &cm.FunctionListInput{FunctionID: "nothing"}
	get := &cm.BuildGetInput{RunID: "nothing"}

	t.Run("allowed callers", func(t *testing.T) {
		if _, err := e.functions.FunctionList(ctx, list); err != nil {
			t.Fatal(err)
		}
		_, err := e.builds.BuildGet(ctx, get)
		expectError(t, err, 404, cm.CodeBuildNotFound)
	})
	t.Run("no token", func(t *testing.T) {
		_, err := e.client(t, "").FunctionList(ctx, list)
		expectError(t, err, 401, "")
	})
	t.Run("ServiceAccount not on the allowlist", func(t *testing.T) {
		_, err := e.client(t, e.token(t, e.platformNS, "e2e-stranger", controlAudience, nil)).FunctionList(ctx, list)
		expectError(t, err, 403, "")
	})
	t.Run("pod audience on the control port", func(t *testing.T) {
		_, err := e.client(t, e.token(t, e.platformNS, "metorial-functions", podAudience, nil)).FunctionList(ctx, list)
		expectError(t, err, 401, "")
	})
	t.Run("functions caller cannot use builds", func(t *testing.T) {
		_, err := e.functions.BuildGet(ctx, get)
		expectError(t, err, 403, "")
	})
	t.Run("build caller cannot use functions or bundles", func(t *testing.T) {
		_, err := e.builds.FunctionList(ctx, list)
		expectError(t, err, 403, "")
		_, err = e.builds.BundleImport(ctx, &cm.BundleImportInput{VersionID: "v", Source: cm.ObjectRef{Bucket: artifactBucket, Key: "x"}})
		expectError(t, err, 403, "")
	})
	t.Run("bucket allowlists", func(t *testing.T) {
		_, err := e.functions.BundleImport(ctx, &cm.BundleImportInput{VersionID: "v", Source: cm.ObjectRef{Bucket: "not-allowed", Key: "x"}})
		expectError(t, err, 403, cm.CodeObjectNotAllowed)

		_, err = e.builds.BuildStart(ctx, &cm.BuildStartInput{
			RunID:          e.runID + "-denied",
			Image:          cm.BuildStartInputImageBuildUbuntu,
			Script:         "true",
			Env:            map[string]string{},
			Downloads:      []cm.BuildStartInputDownloadsItem{{ArtifactID: "a", Bucket: "function-bay-bundles", Key: "x"}},
			Uploads:        []cm.BuildStartInputUploadsItem{},
			TimeoutSeconds: 60,
			EgressGrant:    "g",
		})
		expectError(t, err, 403, cm.CodeObjectNotAllowed)
	})
}
