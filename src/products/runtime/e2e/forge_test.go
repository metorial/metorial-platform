package e2e

import (
	"bytes"
	"encoding/json"
	"os/exec"
	"strings"
	"testing"

	"k8s.io/utils/ptr"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
	cm "github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/clustermanagerrpc"
)

var forgeSource = map[string]string{
	"package.json": `{"name":"runtime-e2e-forge","version":"1.0.0","private":true,"dependencies":{"is-number":"7.0.0"}}`,
	"index.ts": `import isNumber from 'is-number';

export let handler = async (payload: { value: unknown }) => ({
  isNumber: isNumber(payload.value),
  node: process.version
});
`,
}

type forgeRender struct {
	Script    string                            `json:"script"`
	Downloads []cm.BuildStartInputDownloadsItem `json:"downloads"`
	Uploads   []cm.BuildStartInputUploadsItem   `json:"uploads"`
	Env       map[string]string                 `json:"env"`
}

// renderForgeBuild runs forge's own script renderer (forge/render.ts) for function-bay's knative
// workflow, so the build below executes exactly what forge would submit.
func renderForgeBuild(t *testing.T, runID, sourceKey, uploadPrefix string) *forgeRender {
	t.Helper()
	bun, err := exec.LookPath("bun")
	if err != nil {
		t.Skip("bun is needed to render forge's build script")
	}
	input, _ := json.Marshal(map[string]any{
		"runId":        runID,
		"source":       map[string]string{"id": "fwoa_source", "bucket": artifactBucket, "key": sourceKey},
		"uploadBucket": artifactBucket,
		"uploadPrefix": uploadPrefix,
	})
	cmd := exec.Command(bun, "forge/render.ts")
	cmd.Stdin = bytes.NewReader(input)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		t.Fatalf("render forge script: %v\n%s", err, stderr.String())
	}
	var rendered forgeRender
	if err := json.Unmarshal(out, &rendered); err != nil {
		t.Fatalf("render output: %v", err)
	}
	return &rendered
}

func TestForgeKnativeBuild(t *testing.T) {
	e := setup(t)
	runID := e.runID + "-forge"
	prefix := "runtime-e2e/" + e.runID + "/forge"
	sourceKey := prefix + "/files.zip"
	rendered := renderForgeBuild(t, runID, sourceKey, prefix)
	if len(rendered.Uploads) != 2 {
		t.Fatalf("expected manifest and output uploads, got %+v", rendered.Uploads)
	}
	e.put(t, sourceKey, makeZip(t, forgeSource))

	npm := &policy.Policy{Entries: []policy.Entry{}, Hosts: []policy.HostRule{{Pattern: "registry.npmjs.org", Ports: []int{443}}}}
	build, lines := e.runBuild(t, &cm.BuildStartInput{
		RunID:          runID,
		Image:          cm.BuildStartInputImageBuildUbuntu,
		Script:         rendered.Script,
		Env:            rendered.Env,
		Downloads:      rendered.Downloads,
		Uploads:        rendered.Uploads,
		TimeoutSeconds: 900,
		EgressGrant:    e.buildGrant(t, runID, npm),
	})
	if build.Status != cm.BuildStatusSucceeded {
		t.Fatalf("build %s (exit %v, %s):\n%s", build.Status, ptr.Deref(build.ExitCode, -1), ptr.Deref(build.FailureReason, ""), strings.Join(lines, "\n"))
	}
	for _, marker := range []string{`{"type":"build.start"}`, `{"type":"build.end"}`} {
		if !contains(lines, "X@%%MT0RL-)AL:: "+marker) {
			t.Errorf("build log is missing the forge marker %s", marker)
		}
	}

	manifestObj, err := e.store.GetObject(artifactBucket, rendered.Uploads[0].Key)
	if err != nil {
		t.Fatal(err)
	}
	var manifest struct {
		Runtime struct {
			Handler string `json:"handler"`
		} `json:"runtime"`
	}
	if err := json.Unmarshal(manifestObj.Data, &manifest); err != nil || manifest.Runtime.Handler == "" {
		t.Fatalf("manifest %s: %v", manifestObj.Data, err)
	}
	output, err := e.store.GetObject(artifactBucket, rendered.Uploads[1].Key)
	if err != nil {
		t.Fatal(err)
	}

	modulePath, export, _ := strings.Cut(manifest.Runtime.Handler, ".")
	f := e.deploy(t, "forge", deployOptions{
		zip:        output.Data,
		entrypoint: cm.FunctionEnsureInputEntrypoint{Path: modulePath + ".js", Export: export, Kind: cm.FunctionEnsureInputEntrypointKindModule},
	})
	res := result[struct {
		IsNumber bool   `json:"isNumber"`
		Node     string `json:"node"`
	}](t, e.invoke(t, f, map[string]any{"value": 42}))
	if !res.IsNumber || !strings.HasPrefix(res.Node, "v24.") {
		t.Fatalf("unexpected result %+v", res)
	}
	t.Logf("handler %s, node %s, bundle %d bytes", manifest.Runtime.Handler, res.Node, len(output.Data))
}
