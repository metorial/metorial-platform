package e2e

import (
	"context"
	"strings"
	"testing"
	"time"

	"k8s.io/utils/ptr"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
	cm "github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/clustermanagerrpc"
)

const npmBuildScript = `set -euo pipefail
auth="Authorization: Bearer $(cat "$CLUSTER_MANAGER_TOKEN_FILE")"
base="$CLUSTER_MANAGER_POD_ADDR/v1/builds/self"

curl -fsS -H "$auth" "$base/artifacts/source" -o source.txt
npm view is-number@7.0.0 version > version.txt
mkdir pkg && cd pkg
npm init -y > /dev/null
npm install --no-audit --no-fund --loglevel=error is-number@7.0.0
cd ..
node -e 'console.log(require("./pkg/node_modules/is-number")(5))' > isnum.txt
printf '%s|%s|%s' "$(cat source.txt)" "$(cat version.txt)" "$(cat isnum.txt)" > result.txt
curl -fsS -X PUT -H "$auth" --data-binary @result.txt "$base/uploads/result"
echo

echo "denied=$(curl -s -o /dev/null -w '%{http_connect}' https://example.com/ || true)"
for target in https://1.1.1.1/ "https://$API_SERVER_IP/"; do
  echo "direct $target=$(curl -sk --noproxy '*' --max-time 5 -o /dev/null -w '%{http_code}' "$target" || true)"
done
echo "control=$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "http://$CONTROL_IP:52240/rpc" || true)"
`

func (e *env) buildGrant(t *testing.T, runID string, p *policy.Policy) string {
	t.Helper()
	now := time.Now()
	grant, err := egress.MintGrant(e.key, egress.Grant{
		Issuer:     "forge",
		ID:         runID,
		BuildRunID: runID,
		Source:     egress.SourceBuild,
		Policy:     p,
		IssuedAt:   now.Unix(),
		NotBefore:  now.Unix(),
		ExpiresAt:  now.Add(15 * time.Minute).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	return grant
}

func (e *env) runBuild(t *testing.T, in *cm.BuildStartInput) (*cm.Build, []string) {
	t.Helper()
	ctx := context.Background()
	started := time.Now()
	if _, err := e.builds.BuildStart(ctx, in); err != nil {
		t.Fatalf("build:start %s: %v", in.RunID, err)
	}
	t.Cleanup(func() {
		if _, err := e.builds.BuildDelete(context.Background(), &cm.BuildDeleteInput{RunID: in.RunID}); err != nil {
			t.Logf("build:delete %s: %v", in.RunID, err)
		}
	})

	var build *cm.Build
	eventually(t, 6*time.Minute, "build "+in.RunID, func() (bool, error) {
		b, err := e.builds.BuildGet(ctx, &cm.BuildGetInput{RunID: in.RunID})
		if err != nil {
			return false, err
		}
		build = b
		return b.Status == cm.BuildStatusSucceeded || b.Status == cm.BuildStatusFailed, nil
	})

	var lines []string
	var cursor *string
	for range 200 {
		out, err := e.builds.BuildLogs(ctx, &cm.BuildLogsInput{RunID: in.RunID, Cursor: cursor, Limit: ptr.To(int64(500))})
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
	for _, l := range lines {
		if strings.HasPrefix(l, "policy gate:") {
			t.Fatalf("build %s was stopped by the policy gate:\n%s", in.RunID, strings.Join(lines, "\n"))
		}
	}
	t.Logf("build %s %s after %s", in.RunID, build.Status, time.Since(started).Round(time.Millisecond))
	return build, lines
}

func logValue(lines []string, key string) (string, bool) {
	for _, l := range lines {
		if value, ok := strings.CutPrefix(l, key+"="); ok {
			return value, true
		}
	}
	return "", false
}

func TestBuilds(t *testing.T) {
	e := setup(t)
	npmOnly := &policy.Policy{Entries: []policy.Entry{}, Hosts: []policy.HostRule{{Pattern: "registry.npmjs.org", Ports: []int{443}}}}

	t.Run("artifacts and npm through the gateway proxy", func(t *testing.T) {
		runID := e.runID + "-npm"
		sourceKey := "runtime-e2e/" + e.runID + "/build-source.txt"
		resultKey := "runtime-e2e/" + e.runID + "/build-result.txt"
		e.put(t, sourceKey, []byte("from-artifact"))

		build, lines := e.runBuild(t, &cm.BuildStartInput{
			RunID:          runID,
			Image:          cm.BuildStartInputImageBuildUbuntu,
			Script:         npmBuildScript,
			Env:            map[string]string{"API_SERVER_IP": e.apiServerIP, "CONTROL_IP": e.clusterManagerIP},
			Downloads:      []cm.BuildStartInputDownloadsItem{{ArtifactID: "source", Bucket: artifactBucket, Key: sourceKey}},
			Uploads:        []cm.BuildStartInputUploadsItem{{StepID: "result", Bucket: artifactBucket, Key: resultKey}},
			TimeoutSeconds: 600,
			EgressGrant:    e.buildGrant(t, runID, npmOnly),
		})
		if build.Status != cm.BuildStatusSucceeded {
			t.Fatalf("build %s (exit %v, %s):\n%s", build.Status, ptr.Deref(build.ExitCode, -1), ptr.Deref(build.FailureReason, ""), strings.Join(lines, "\n"))
		}

		obj, err := e.store.GetObject(artifactBucket, resultKey)
		if err != nil {
			t.Fatal(err)
		}
		if string(obj.Data) != "from-artifact|7.0.0|true" {
			t.Fatalf("uploaded result %q", obj.Data)
		}

		if denied, _ := logValue(lines, "denied"); denied != "403" {
			t.Errorf("a host outside the grant answered %q through the proxy, want 403", denied)
		}
		if control, _ := logValue(lines, "control"); control != "000" {
			t.Errorf("the build pod reached the cluster-manager control port (HTTP %s)", control)
		}
		for _, target := range []string{"https://1.1.1.1/", "https://" + e.apiServerIP + "/"} {
			code, _ := logValue(lines, "direct "+target)
			switch {
			case code == "000":
			case e.strictNP:
				t.Errorf("a direct connection to %s bypassed the proxy (HTTP %s)", target, code)
			default:
				t.Logf("NOT ENFORCED HERE: a direct connection to %s bypassed the proxy (HTTP %s)", target, code)
			}
		}
	})

	t.Run("a host outside the grant fails the build", func(t *testing.T) {
		runID := e.runID + "-denied"
		build, lines := e.runBuild(t, &cm.BuildStartInput{
			RunID:          runID,
			Image:          cm.BuildStartInputImageBuildUbuntu,
			Script:         "set -euo pipefail\ncurl -fsS https://example.com/ -o /dev/null\necho unreachable",
			Env:            map[string]string{},
			Downloads:      []cm.BuildStartInputDownloadsItem{},
			Uploads:        []cm.BuildStartInputUploadsItem{},
			TimeoutSeconds: 120,
			EgressGrant:    e.buildGrant(t, runID, npmOnly),
		})
		if build.Status != cm.BuildStatusFailed || ptr.Deref(build.ExitCode, 0) == 0 || contains(lines, "unreachable") {
			t.Fatalf("expected a failed build, got %s (exit %v):\n%s", build.Status, ptr.Deref(build.ExitCode, -1), strings.Join(lines, "\n"))
		}
	})

	t.Run("a grant for another build is rejected by the gateway", func(t *testing.T) {
		runID := e.runID + "-wronggrant"
		build, lines := e.runBuild(t, &cm.BuildStartInput{
			RunID:          runID,
			Image:          cm.BuildStartInputImageBuildUbuntu,
			Script:         "echo \"code=$(curl -s -o /dev/null -w '%{http_connect}' https://registry.npmjs.org/ || true)\"",
			Env:            map[string]string{},
			Downloads:      []cm.BuildStartInputDownloadsItem{},
			Uploads:        []cm.BuildStartInputUploadsItem{},
			TimeoutSeconds: 120,
			EgressGrant:    e.buildGrantWithKey(t, randomKey(t), runID),
		})
		if code, _ := logValue(lines, "code"); build.Status != cm.BuildStatusSucceeded || code != "407" {
			t.Fatalf("a grant signed by an unknown key got CONNECT %q:\n%s", code, strings.Join(lines, "\n"))
		}
	})
}

func (e *env) buildGrantWithKey(t *testing.T, key *egress.SigningKey, runID string) string {
	t.Helper()
	now := time.Now()
	grant, err := egress.MintGrant(key, egress.Grant{Issuer: "forge", ID: runID, BuildRunID: runID, Source: egress.SourceBuild, IssuedAt: now.Unix(), ExpiresAt: now.Add(10 * time.Minute).Unix()})
	if err != nil {
		t.Fatal(err)
	}
	return grant
}
