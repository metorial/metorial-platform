package e2e

import (
	"cmp"
	"context"
	"fmt"
	"net"
	"strings"
	"testing"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/utils/ptr"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
	cm "github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/clustermanagerrpc"
)

// firstInstantFunction opens raw sockets (no interception) while the module is still loading,
// the earliest moment user code runs in a fresh pod.
const firstInstantFunction = `
const started = process.uptime();
const { handler } = require('./probe.js');
const results = Promise.all((process.env.FIRST_INSTANT_TARGETS || '').split(',').map(target => {
  const i = target.lastIndexOf(':');
  return handler({ op: 'raw', host: target.slice(0, i), port: Number(target.slice(i + 1)) }).then(r => ({ target, ...r }));
}));
exports.handler = async () => ({ startedMs: Math.round(started * 1000), results: await results });
`

const firstInstantBuildScript = `for target in $FIRST_INSTANT_TARGETS; do
  if timeout 3 bash -c 'exec 3<>"/dev/tcp/${0%:*}/${0##*:}"' "$target" 2>/dev/null; then echo "first $target=open"; else echo "first $target=blocked"; fi
done
`

// TestPolicyGate checks the window between pod start and NetworkPolicy enforcement is closed:
// user code that connects at the very first instant must already be refused.
func TestPolicyGate(t *testing.T) {
	e := setup(t)
	type target struct {
		name   string
		addr   string
		strict bool
	}
	targets := []target{
		{"API server", net.JoinHostPort(e.apiServerIP, "443"), true},
		{"cluster-manager control port", net.JoinHostPort(e.clusterManagerPod, "52240"), false},
	}
	addrs := make([]string, len(targets))
	for i, tg := range targets {
		addrs[i] = tg.addr
	}
	check := func(t *testing.T, tg target, open bool, detail string) {
		switch {
		case !open:
			t.Logf("%s refused at the first instant (%s)", tg.name, detail)
		case !tg.strict || e.strictNP:
			t.Errorf("user code reached the %s at the first instant (%s)", tg.name, detail)
		default:
			t.Logf("NOT ENFORCED HERE: user code reached the %s at the first instant (%s)", tg.name, detail)
		}
	}

	t.Run("a function connecting while its module loads", func(t *testing.T) {
		f := e.deploy(t, "first-instant", deployOptions{
			files: map[string]string{"index.js": firstInstantFunction, "probe.js": probeFunction},
			env:   map[string]string{"FIRST_INSTANT_TARGETS": strings.Join(addrs, ",")},
		})
		res := result[struct {
			StartedMs int `json:"startedMs"`
			Results   []struct {
				Target string `json:"target"`
				OK     bool   `json:"ok"`
				Error  string `json:"error"`
			} `json:"results"`
		}](t, e.invoke(t, f, map[string]any{}))
		if len(res.Results) != len(targets) {
			t.Fatalf("unexpected result %+v", res)
		}
		for i, r := range res.Results {
			check(t, targets[i], r.OK, fmt.Sprintf("%s, %d ms after the worker started", cmp.Or(r.Error, "connected"), res.StartedMs))
		}
		if gate := e.podLogLine(t, e.functionsNS, versionLabel+"="+f.versionID, "policy gate closed"); gate != "" {
			t.Logf("supervisor: %s", gate)
		}
	})

	t.Run("a build connecting on its first line", func(t *testing.T) {
		runID := e.runID + "-first-instant"
		build, lines := e.runBuild(t, &cm.BuildStartInput{
			RunID:          runID,
			Image:          cm.BuildStartInputImageBuildUbuntu,
			Script:         firstInstantBuildScript,
			Env:            map[string]string{"FIRST_INSTANT_TARGETS": strings.Join(addrs, " ")},
			Downloads:      []cm.BuildStartInputDownloadsItem{},
			Uploads:        []cm.BuildStartInputUploadsItem{},
			TimeoutSeconds: 120,
			EgressGrant:    e.buildGrant(t, runID, &policy.Policy{Entries: []policy.Entry{}, Hosts: []policy.HostRule{}}),
		})
		if build.Status != cm.BuildStatusSucceeded {
			t.Fatalf("build %s (exit %v):\n%s", build.Status, ptr.Deref(build.ExitCode, -1), strings.Join(lines, "\n"))
		}
		for _, tg := range targets {
			state, ok := logValue(lines, "first "+tg.addr)
			if !ok {
				t.Fatalf("no result for %s:\n%s", tg.addr, strings.Join(lines, "\n"))
			}
			check(t, tg, state != "blocked", state)
		}
	})
}

// podLogLine returns the first log line containing substr from a pod matching selector.
func (e *env) podLogLine(t *testing.T, namespace, selector, substr string) string {
	t.Helper()
	ctx := context.Background()
	for _, pod := range e.runningPods(t, namespace, selector) {
		raw, err := e.kube.CoreV1().Pods(namespace).GetLogs(pod.Name, &corev1.PodLogOptions{Container: "function", LimitBytes: ptr.To(int64(1 << 20))}).DoRaw(ctx)
		if err != nil {
			t.Logf("logs of %s: %v", pod.Name, err)
			continue
		}
		for _, line := range strings.Split(string(raw), "\n") {
			if strings.Contains(line, substr) {
				return line
			}
		}
	}
	return ""
}
