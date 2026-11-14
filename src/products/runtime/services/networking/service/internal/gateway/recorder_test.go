package gateway

import (
	"context"
	"errors"
	"net/http"
	"net/netip"
	"strconv"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/rpc/networklogsrpc"
)

type captureSender struct {
	batches []Batch
	fail    int
}

func (c *captureSender) Send(_ context.Context, batch Batch) error {
	if c.fail > 0 {
		c.fail--
		return errors.New("unavailable")
	}
	c.batches = append(c.batches, batch)
	return nil
}

func fixedClock(start time.Time) (func() time.Time, func(time.Duration)) {
	now := start
	return func() time.Time { return now }, func(d time.Duration) { now = now.Add(d) }
}

func TestRecorderAggregatesPerBucketAndKey(t *testing.T) {
	recorder := NewRecorder("gw", time.Hour, nil)
	clock, advance := fixedClock(time.Date(2026, 11, 13, 10, 29, 0, 0, time.UTC))
	recorder.now = clock

	function := &egress.Grant{TenantID: "t", FunctionID: "f", Source: egress.SourceLambda}
	build := &egress.Grant{BuildRunID: "run", Source: egress.SourceBuild}

	recorder.Record(function, "a.test", "1.1.1.1", 443, DecisionAllowed)
	advance(30 * time.Second)
	recorder.Record(function, "a.test", "1.1.1.1", 443, DecisionAllowed)
	recorder.Record(function, "a.test", "1.1.1.1", 443, DecisionDenied)
	recorder.Record(build, "a.test", "1.1.1.1", 443, DecisionAllowed)
	advance(time.Minute)
	recorder.Record(function, "a.test", "1.1.1.1", 443, DecisionAllowed)

	sender := &captureSender{}
	if sent, err := recorder.Flush(context.Background(), sender); err != nil || sent != 1 {
		t.Fatalf("flush sent=%d err=%v", sent, err)
	}

	byKey := map[string]Observation{}
	for _, observation := range sender.batches[0].Observations {
		byKey[observation.BucketStart.Format("15:04")+"/"+string(observation.Decision)+"/"+string(observation.Source)] = observation
	}
	if len(byKey) != 4 {
		t.Fatalf("observations %+v", byKey)
	}

	first := byKey["10:00/allowed/lambda"]
	if first.Count != 2 || !first.FirstSeenAt.Equal(time.Date(2026, 11, 13, 10, 29, 0, 0, time.UTC)) || !first.LastSeenAt.Equal(time.Date(2026, 11, 13, 10, 29, 30, 0, time.UTC)) {
		t.Fatalf("first bucket %+v", first)
	}
	if byKey["10:30/allowed/lambda"].Count != 1 || byKey["10:00/denied/lambda"].Count != 1 {
		t.Fatalf("buckets %+v", byKey)
	}
	if built := byKey["10:00/allowed/build"]; built.BuildRunID != "run" || built.TenantID != "" {
		t.Fatalf("build observation %+v", built)
	}
	if sender.batches[0].ID != "gw:1" || sender.batches[0].InstanceID != "gw" {
		t.Fatalf("batch %s/%s", sender.batches[0].ID, sender.batches[0].InstanceID)
	}
}

func TestRecorderRetriesSameBatchID(t *testing.T) {
	recorder := NewRecorder("gw", time.Hour, nil)
	grant := &egress.Grant{TenantID: "t", FunctionID: "f", Source: egress.SourceKnative}
	recorder.Record(grant, "a.test", "1.1.1.1", 443, DecisionAllowed)

	sender := &captureSender{fail: 1}
	if _, err := recorder.Flush(context.Background(), sender); err == nil {
		t.Fatal("expected failure")
	}
	recorder.Record(grant, "b.test", "1.1.1.2", 443, DecisionAllowed)
	if _, err := recorder.Flush(context.Background(), sender); err != nil {
		t.Fatal(err)
	}

	if len(sender.batches) != 2 || sender.batches[0].ID != "gw:1" || len(sender.batches[0].Observations) != 1 || sender.batches[0].Observations[0].Hostname != "a.test" {
		t.Fatalf("batches %+v", sender.batches)
	}
	if sender.batches[1].ID != "gw:2" || sender.batches[1].Observations[0].Hostname != "b.test" {
		t.Fatalf("second batch %+v", sender.batches[1])
	}
	if recorder.Pending() != 0 {
		t.Fatalf("pending %d", recorder.Pending())
	}
}

func TestRecorderChunksLargeBatches(t *testing.T) {
	recorder := NewRecorder("gw", time.Hour, nil)
	grant := &egress.Grant{TenantID: "t", FunctionID: "f", Source: egress.SourceLambda}
	for i := range maxBatchSize + 5 {
		recorder.Record(grant, "h"+strconv.Itoa(i), "1.1.1.1", 443, DecisionAllowed)
	}

	sender := &captureSender{}
	sent, err := recorder.Flush(context.Background(), sender)
	if err != nil || sent != 2 {
		t.Fatalf("sent=%d err=%v", sent, err)
	}
	if len(sender.batches[0].Observations) != maxBatchSize || len(sender.batches[1].Observations) != 5 {
		t.Fatalf("batch sizes %d %d", len(sender.batches[0].Observations), len(sender.batches[1].Observations))
	}
}

func TestRecorderDropsObservationsOlderThanMaxAge(t *testing.T) {
	dropped := 0
	recorder := NewRecorder("gw", 15*time.Minute, func(n int) { dropped += n })
	clock, advance := fixedClock(time.Now())
	recorder.now = clock

	grant := &egress.Grant{TenantID: "t", FunctionID: "f", Source: egress.SourceLambda}
	recorder.Record(grant, "old.test", "1.1.1.1", 443, DecisionAllowed)
	if _, err := recorder.Flush(context.Background(), &captureSender{fail: 1}); err == nil {
		t.Fatal("expected failure")
	}
	advance(16 * time.Minute)
	recorder.Record(grant, "new.test", "1.1.1.1", 443, DecisionAllowed)

	sender := &captureSender{}
	if _, err := recorder.Flush(context.Background(), sender); err != nil {
		t.Fatal(err)
	}
	if dropped != 1 || len(sender.batches) != 1 || sender.batches[0].Observations[0].Hostname != "new.test" {
		t.Fatalf("dropped=%d batches=%+v", dropped, sender.batches)
	}
}

func TestObservationsArriveAtLogStore(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	env.route("93.184.216.34:443", startEcho(t))
	store, sender := startFakeLogStore(t)
	store.failures = 1

	client := env.tunnelClient()
	if tn := env.openTunnel(client, "example.test:443", env.grant()); tn.status != http.StatusOK {
		t.Fatalf("status %d", tn.status)
	}
	if tn := env.openTunnel(client, "metadata.test:80", env.grant()); tn.status != http.StatusForbidden {
		t.Fatalf("status %d", tn.status)
	}

	conn, reader := env.proxyConn()
	build := env.newGrant(func(g *egress.Grant) {
		*g = egress.Grant{ID: g.ID, BuildRunID: "brun_1", Source: egress.SourceBuild, IssuedAt: g.IssuedAt, ExpiresAt: g.ExpiresAt}
	})
	_, _ = conn.Write([]byte("CONNECT example.test:443 HTTP/1.1\r\nHost: example.test:443\r\nProxy-Authorization: Bearer " + env.mint(build) + "\r\n\r\n"))
	if line, _ := reader.ReadString('\n'); line != "HTTP/1.1 200 Connection Established\r\n" {
		t.Fatalf("proxy status %q", line)
	}

	if _, err := env.core.Recorder.Flush(context.Background(), sender); err == nil {
		t.Fatal("expected the first ingest to fail")
	}
	if _, err := env.core.Recorder.Flush(context.Background(), sender); err != nil {
		t.Fatal(err)
	}

	store.mu.Lock()
	defer store.mu.Unlock()
	if len(store.batches) != 1 || store.batches[0].BatchID != "gw-test:1" || store.batches[0].GatewayInstanceID != "gw-test" {
		t.Fatalf("batches %+v", store.batches)
	}

	found := map[string]networklogsrpc.Observation{}
	for _, observation := range store.batches[0].Observations {
		found[string(observation.Source)+"/"+string(observation.Decision)+"/"+observation.Hostname] = observation
	}

	allowed, ok := found["lambda/allowed/example.test"]
	if !ok || allowed.IP != "93.184.216.34" || allowed.Port != 443 || allowed.TenantID != "ten_1" ||
		deref(allowed.EnclaveID) != "enc_1" || deref(allowed.EffectiveFunctionID) != "fn_eff_1" || allowed.BuildRunID != nil {
		t.Fatalf("allowed observation %+v", allowed)
	}
	if denied, ok := found["lambda/denied/metadata.test"]; !ok || denied.IP != "169.254.169.254" || denied.Port != 80 {
		t.Fatalf("denied observation %+v (all %v)", denied, found)
	}
	if built, ok := found["build/allowed/example.test"]; !ok || deref(built.BuildRunID) != "brun_1" || built.TenantID != "" || built.EnclaveID != nil {
		t.Fatalf("build observation %+v", built)
	}
	if allowed.BucketStart.Minute()%30 != 0 || allowed.BucketStart.Second() != 0 {
		t.Fatalf("bucket %s", allowed.BucketStart)
	}
}

func TestShipFlushesOnShutdown(t *testing.T) {
	store, sender := startFakeLogStore(t)
	recorder := NewRecorder("gw", time.Hour, nil)
	recorder.Record(&egress.Grant{TenantID: "t", FunctionID: "f", Source: egress.SourceLambda}, "a.test", "1.1.1.1", 443, DecisionAllowed)

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		Ship(ctx, recorder, sender, time.Hour, NewMetrics(), testLogger())
		close(done)
	}()
	cancel()
	<-done

	store.mu.Lock()
	defer store.mu.Unlock()
	if len(store.batches) != 1 {
		t.Fatalf("batches %d", len(store.batches))
	}
}

func TestResolveMemoryExpiresAndIsolatesGrants(t *testing.T) {
	memory := NewResolveMemory()
	clock, advance := fixedClock(time.Now())
	memory.now = clock

	addr := netip.MustParseAddr("93.184.216.40")
	memory.Remember("a", clock().Add(time.Minute), "api.example.test", []netip.Addr{addr})

	if got := memory.Lookup("a", addr); got != "api.example.test" {
		t.Fatalf("lookup %q", got)
	}
	if got := memory.Lookup("b", addr); got != "" {
		t.Fatalf("other grant %q", got)
	}

	advance(2 * time.Minute)
	if got := memory.Lookup("a", addr); got != "" {
		t.Fatalf("expired %q", got)
	}
	memory.Prune()
	if memory.Len() != 0 {
		t.Fatalf("len %d", memory.Len())
	}
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
