package gc

import (
	"context"
	"io"
	"log/slog"
	"slices"
	"testing"
	"time"
)

var t0 = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

var policy = Policy{
	SpeculativeTTL:  time.Hour,
	IdleTTL:         6 * time.Hour,
	MaxMaterialized: 3,
	ProtectWindow:   5 * time.Minute,
}

func at(d time.Duration) *time.Time {
	t := t0.Add(d)
	return &t
}

func evicted(evictions []Eviction) map[string]Reason {
	out := map[string]Reason{}
	for _, e := range evictions {
		out[e.Candidate.Name] = e.Reason
	}
	return out
}

func TestSpeculativeTTL(t *testing.T) {
	now := t0.Add(61 * time.Minute)
	got := evicted(Decide(now, []Candidate{
		{Name: "spec-old", Speculative: true, CreatedAt: t0},
		{Name: "spec-young", Speculative: true, CreatedAt: t0.Add(30 * time.Minute)},
		{Name: "spec-used", Speculative: true, CreatedAt: t0, LastInvokedAt: at(time.Minute)},
		{Name: "on-demand", CreatedAt: t0},
	}, policy))

	if len(got) != 1 || got["spec-old"] != ReasonSpeculativeTTL {
		t.Fatalf("unexpected evictions %v", got)
	}
}

func TestIdleTTL(t *testing.T) {
	now := t0.Add(7 * time.Hour)
	got := evicted(Decide(now, []Candidate{
		{Name: "idle", CreatedAt: t0, LastInvokedAt: at(30 * time.Minute)},
		{Name: "never-invoked", CreatedAt: t0},
		{Name: "recent", CreatedAt: t0, LastInvokedAt: at(2 * time.Hour)},
		{Name: "spec-promoted-idle", Speculative: true, CreatedAt: t0, LastInvokedAt: at(time.Minute)},
	}, policy))

	want := map[string]Reason{"idle": ReasonIdleTTL, "never-invoked": ReasonIdleTTL, "spec-promoted-idle": ReasonIdleTTL}
	if len(got) != len(want) {
		t.Fatalf("unexpected evictions %v", got)
	}
	for name, reason := range want {
		if got[name] != reason {
			t.Fatalf("%s: got %q, want %q (all: %v)", name, got[name], reason, got)
		}
	}
}

func TestCapPrefersZeroPodVersionsThenLRU(t *testing.T) {
	now := t0.Add(time.Hour)
	candidates := []Candidate{
		{Name: "warm-old", CreatedAt: t0, LastInvokedAt: at(10 * time.Minute), Pods: 1},
		{Name: "cold-new", CreatedAt: t0, LastInvokedAt: at(50 * time.Minute)},
		{Name: "cold-old", CreatedAt: t0, LastInvokedAt: at(20 * time.Minute)},
		{Name: "warm-hot", CreatedAt: t0, LastInvokedAt: at(58 * time.Minute), Pods: 2},
		{Name: "cold-mid", CreatedAt: t0, LastInvokedAt: at(30 * time.Minute)},
	}

	got := Decide(now, candidates, policy)
	names := make([]string, len(got))
	for i, e := range got {
		names[i] = e.Candidate.Name
		if e.Reason != ReasonCap {
			t.Fatalf("unexpected reason %s", e.Reason)
		}
	}
	if !slices.Equal(names, []string{"cold-old", "cold-mid"}) {
		t.Fatalf("unexpected cap evictions %v", names)
	}
}

func TestSelectLRUNeverEvictsRecentlyUsedWarmVersions(t *testing.T) {
	now := t0.Add(time.Hour)
	got := SelectLRU(now, []Candidate{
		{Name: "warm-hot-1", CreatedAt: t0, LastInvokedAt: at(59 * time.Minute), Pods: 1},
		{Name: "warm-hot-2", CreatedAt: t0, LastInvokedAt: at(58 * time.Minute), Pods: 1},
		{Name: "warm-stale", CreatedAt: t0, LastInvokedAt: at(10 * time.Minute), Pods: 1},
	}, 3, 5*time.Minute)

	if len(got) != 1 || got[0].Name != "warm-stale" {
		t.Fatalf("unexpected selection %v", got)
	}
	if SelectLRU(now, nil, 0, time.Minute) != nil {
		t.Fatal("n=0 should select nothing")
	}
}

type fakeTarget struct {
	candidates []Candidate
	evicted    []string
}

func (f *fakeTarget) Candidates() ([]Candidate, error) { return f.candidates, nil }

func (f *fakeTarget) Evict(_ context.Context, c Candidate, _ Reason) error {
	f.evicted = append(f.evicted, c.Name)
	f.candidates = slices.DeleteFunc(f.candidates, func(other Candidate) bool { return other.Name == c.Name })
	return nil
}

func TestCollectorRunOnceWithFakeClock(t *testing.T) {
	clock := t0
	target := &fakeTarget{candidates: []Candidate{
		{Name: "spec", Speculative: true, CreatedAt: t0},
		{Name: "used", CreatedAt: t0, LastInvokedAt: at(0)},
	}}
	swept := 0
	c := &Collector{
		Target:   target,
		Sweepers: []Sweeper{func(context.Context) error { swept++; return nil }},
		Policy:   policy,
		Log:      slog.New(slog.NewTextHandler(io.Discard, nil)),
		Now:      func() time.Time { return clock },
	}

	if done, _ := c.RunOnce(context.Background()); len(done) != 0 {
		t.Fatalf("nothing should expire yet: %v", done)
	}

	clock = t0.Add(2 * time.Hour)
	c.RunOnce(context.Background())
	if !slices.Equal(target.evicted, []string{"spec"}) {
		t.Fatalf("unexpected evictions %v", target.evicted)
	}

	clock = t0.Add(7 * time.Hour)
	c.RunOnce(context.Background())
	if !slices.Equal(target.evicted, []string{"spec", "used"}) {
		t.Fatalf("unexpected evictions %v", target.evicted)
	}
	if swept != 3 {
		t.Fatalf("sweepers ran %d times", swept)
	}
}
