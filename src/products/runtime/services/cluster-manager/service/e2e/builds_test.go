package e2e

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/kube"
	cm "github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/clustermanagerrpc"
)

const buildScript = `set -euo pipefail
auth="Authorization: Bearer $(cat "$CLUSTER_MANAGER_TOKEN_FILE")"
base="$CLUSTER_MANAGER_POD_ADDR/v1/builds/self"
curl -fsS -H "$auth" "$base/artifacts/source" -o src.txt
tr a-z A-Z < src.txt > out.txt
curl -fsS -X PUT -H "$auth" --data-binary @out.txt "$base/uploads/result"
echo
echo "undeclared=$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H "$auth" --data-binary @out.txt "$base/uploads/undeclared")"
for i in $(seq 1 40); do echo "line $i $GREETING"; done
sleep "$HOLD_SECONDS"
`

func isAlreadyExists(err error) bool { return apierrors.IsAlreadyExists(err) }

func (e *env) startInput(runID, script string, hold int) *cm.BuildStartInput {
	return &cm.BuildStartInput{
		RunID:          runID,
		Image:          cm.BuildStartInputImageBuildUbuntu,
		Script:         script,
		Env:            map[string]string{"GREETING": "it's $HOME", "HOLD_SECONDS": fmt.Sprint(hold)},
		Downloads:      []cm.BuildStartInputDownloadsItem{{ArtifactID: "source", Bucket: artifactBucket, Key: "e2e/" + e.runID + "/src.txt"}},
		Uploads:        []cm.BuildStartInputUploadsItem{{StepID: "result", Bucket: artifactBucket, Key: "e2e/" + e.runID + "/out.txt"}},
		TimeoutSeconds: 300,
		EgressGrant:    "e2e-grant",
	}
}

func (e *env) waitBuild(t *testing.T, runID string) *cm.Build {
	t.Helper()
	var build *cm.Build
	eventually(t, 3*time.Minute, "build "+runID+" to finish", func() (bool, error) {
		b, err := e.builds.BuildGet(context.Background(), &cm.BuildGetInput{RunID: runID})
		if err != nil {
			return false, err
		}
		build = b
		return b.Status == cm.BuildStatusSucceeded || b.Status == cm.BuildStatusFailed, nil
	})
	return build
}

func TestBuildLifecycle(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	runID := e.runID + "-ok"
	e.put(t, "e2e/"+e.runID+"/src.txt", []byte("hello build"))

	t.Run("reserved env is rejected", func(t *testing.T) {
		in := e.startInput(e.runID+"-bad", "true", 0)
		in.Env["HTTPS_PROXY"] = "http://evil"
		_, err := e.builds.BuildStart(ctx, in)
		expectError(t, err, 400, "invalid_data")
	})

	var name string
	t.Run("start is idempotent", func(t *testing.T) {
		first, err := e.builds.BuildStart(ctx, e.startInput(runID, buildScript, 20))
		if err != nil {
			t.Fatal(err)
		}
		second, err := e.builds.BuildStart(ctx, e.startInput(runID, buildScript, 20))
		if err != nil || second.Name != first.Name {
			t.Fatalf("second start: %+v %v", second, err)
		}
		name = first.Name

		secret, err := e.kube.CoreV1().Secrets(e.buildsNS).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			t.Fatal(err)
		}
		if len(secret.OwnerReferences) != 1 || secret.OwnerReferences[0].Kind != "Job" || secret.OwnerReferences[0].Name != name {
			t.Fatalf("build Secret not owned by the Job: %+v", secret.OwnerReferences)
		}
		job, err := e.kube.BatchV1().Jobs(e.buildsNS).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			t.Fatal(err)
		}
		if ptr.Deref(job.Spec.BackoffLimit, -1) != 0 || ptr.Deref(job.Spec.ActiveDeadlineSeconds, 0) != 300 {
			t.Fatalf("unexpected Job spec %+v", job.Spec)
		}
	})

	t.Run("pod-facing endpoints are scoped to the build", func(t *testing.T) {
		pod := e.runningPod(t, e.buildsNS, kube.LabelBuildID+"="+runID)
		token := e.token(t, e.buildsNS, "build-runtime", podAudience, pod)

		if code, body := e.podGet(t, "/v1/builds/self/artifacts/source", token); code != 200 || string(body) != "hello build" {
			t.Fatalf("declared artifact: %d %q", code, body)
		}
		if code, _ := e.podGet(t, "/v1/builds/self/artifacts/other", token); code != 403 {
			t.Fatalf("undeclared artifact: %d", code)
		}
		if code, _ := e.podGet(t, "/v1/bundles/self", token); code != 403 && code != 404 {
			t.Fatalf("build pod reached the bundle endpoint: %d", code)
		}
		_, err := e.client(t, token).BuildGet(ctx, &cm.BuildGetInput{RunID: runID})
		expectError(t, err, 401, "")
	})

	t.Run("succeeds with upload and paged logs", func(t *testing.T) {
		build := e.waitBuild(t, runID)
		if build.Status != cm.BuildStatusSucceeded || ptr.Deref(build.ExitCode, -1) != 0 || !contains(build.UploadedSteps, "result") {
			t.Fatalf("unexpected build %+v (failure: %v)", build, ptr.Deref(build.FailureReason, ""))
		}
		if build.StartedAt == nil || build.FinishedAt == nil {
			t.Fatalf("missing timestamps %+v", build)
		}

		obj, err := e.store.GetObject(artifactBucket, "e2e/"+e.runID+"/out.txt")
		if err != nil {
			t.Fatal(err)
		}
		if string(obj.Data) != "HELLO BUILD" {
			t.Fatalf("uploaded object: %q", obj.Data)
		}

		var lines []string
		var cursor *string
		for page := 0; page < 30; page++ {
			out, err := e.builds.BuildLogs(ctx, &cm.BuildLogsInput{RunID: runID, Cursor: cursor, Limit: ptr.To(int64(7))})
			if err != nil {
				t.Fatal(err)
			}
			if len(out.Lines) == 0 {
				break
			}
			for _, l := range out.Lines {
				lines = append(lines, l.Line)
			}
			cursor = ptr.To(out.NextCursor)
		}

		var numbered []string
		for _, l := range lines {
			if strings.HasPrefix(l, "line ") {
				numbered = append(numbered, l)
			}
		}
		if len(numbered) != 40 || numbered[0] != "line 1 it's $HOME" || numbered[39] != "line 40 it's $HOME" {
			t.Fatalf("unexpected paged logs (%d numbered lines): %q", len(numbered), lines)
		}
		for i, l := range numbered {
			if l != fmt.Sprintf("line %d it's $HOME", i+1) {
				t.Fatalf("line %d out of order or duplicated: %q", i+1, l)
			}
		}
		if !contains(lines, "undeclared=403") {
			t.Fatalf("an undeclared upload was not refused: %q", lines)
		}
	})

	t.Run("failure is reported", func(t *testing.T) {
		failing := e.runID + "-fail"
		if _, err := e.builds.BuildStart(ctx, e.startInput(failing, "echo bye; exit 3", 0)); err != nil {
			t.Fatal(err)
		}
		build := e.waitBuild(t, failing)
		if build.Status != cm.BuildStatusFailed || ptr.Deref(build.ExitCode, -1) != 3 {
			t.Fatalf("unexpected failed build %+v", build)
		}
		if _, err := e.builds.BuildDelete(ctx, &cm.BuildDeleteInput{RunID: failing}); err != nil {
			t.Fatal(err)
		}
	})

	t.Run("delete", func(t *testing.T) {
		if _, err := e.builds.BuildDelete(ctx, &cm.BuildDeleteInput{RunID: runID}); err != nil {
			t.Fatal(err)
		}
		eventually(t, time.Minute, "the build to disappear", func() (bool, error) {
			_, err := e.builds.BuildGet(ctx, &cm.BuildGetInput{RunID: runID})
			s, _ := status(err)
			return s == 404, err
		})
		if _, err := e.kube.CoreV1().Secrets(e.buildsNS).Get(ctx, name, metav1.GetOptions{}); !apierrors.IsNotFound(err) {
			t.Fatalf("build Secret left behind: %v", err)
		}
	})
}
