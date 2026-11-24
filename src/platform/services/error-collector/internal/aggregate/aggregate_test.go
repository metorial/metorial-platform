package aggregate

import (
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/issue"
)

var base = time.Date(2026, 11, 20, 10, 15, 0, 0, time.UTC)

func occurrence(hash string, at time.Time, release string) issue.Occurrence {
	return issue.Occurrence{
		Hash:      hash,
		Component: "worker",
		Level:     "error",
		Type:      "Error",
		Value:     hash + " at " + at.Format(time.RFC3339),
		Release:   release,
		Timestamp: at,
		Sample:    &issue.Sample{Timestamp: at.Format(time.RFC3339)},
	}
}

func byHash(groups []*Group) map[string]*Group {
	result := map[string]*Group{}
	for _, group := range groups {
		result[group.Hash] = group
	}
	return result
}

func TestAddCountsPerHourAndRelease(t *testing.T) {
	a := New(10)
	a.Add(occurrence("a", base, "1.0"))
	a.Add(occurrence("a", base.Add(50*time.Minute), "1.1"))
	a.Add(occurrence("a", base.Add(-5*time.Minute), "1.0"))

	groups := byHash(a.Drain())
	group := groups["a"]
	if group == nil || group.Count != 3 {
		t.Fatalf("group = %+v", group)
	}
	if group.Hours[base.Truncate(time.Hour)] != 2 || group.Hours[base.Add(time.Hour).Truncate(time.Hour)] != 1 {
		t.Errorf("hours = %v", group.Hours)
	}
	if !group.FirstSeen.Equal(base.Add(-5*time.Minute)) || !group.LastSeen.Equal(base.Add(50*time.Minute)) {
		t.Errorf("first/last = %v / %v", group.FirstSeen, group.LastSeen)
	}
	if group.Releases["1.0"].Count != 2 || group.Releases["1.1"].Count != 1 {
		t.Errorf("releases = %+v", group.Releases)
	}
	if group.FirstSample.Timestamp != base.Format(time.RFC3339) {
		t.Errorf("first sample = %+v", group.FirstSample)
	}

	if remaining := a.Drain(); len(remaining) != 0 {
		t.Errorf("drain left %d groups", len(remaining))
	}
}

func TestOverflowBeyondMaxGroups(t *testing.T) {
	a := New(2)
	a.Add(occurrence("a", base, ""))
	a.Add(occurrence("b", base, ""))
	a.Add(occurrence("c", base, ""))
	a.Add(occurrence("d", base, ""))
	a.Add(occurrence("a", base, ""))

	groups := byHash(a.Drain())
	if groups["a"].Count != 2 || groups["b"].Count != 1 {
		t.Errorf("known groups miscounted: a=%d b=%d", groups["a"].Count, groups["b"].Count)
	}
	overflow := groups[OverflowHash("worker")]
	if overflow == nil || overflow.Count != 2 || overflow.Type != OverflowType {
		t.Fatalf("overflow = %+v", overflow)
	}
	if overflow.FirstSample != nil || len(overflow.Releases) != 0 {
		t.Error("overflow groups keep no samples or releases")
	}
}

func TestRestoreMergesWithNewArrivals(t *testing.T) {
	a := New(10)
	a.Add(occurrence("a", base, "1.0"))
	failed := a.Drain()

	a.Add(occurrence("a", base.Add(2*time.Hour), "1.0"))
	a.Restore(failed)

	group := byHash(a.Drain())["a"]
	if group.Count != 2 || group.Releases["1.0"].Count != 2 {
		t.Errorf("restored group = %+v", group)
	}
	if !group.FirstSeen.Equal(base) || !group.LastSeen.Equal(base.Add(2*time.Hour)) {
		t.Errorf("first/last = %v / %v", group.FirstSeen, group.LastSeen)
	}
	if group.LatestSample.Timestamp != base.Add(2*time.Hour).Format(time.RFC3339) {
		t.Error("an older restored sample replaced the newer one")
	}
	if group.FirstSample.Timestamp != base.Format(time.RFC3339) {
		t.Error("the restored, older sample should become the first sample")
	}
}

func TestRestoreRespectsMaxGroups(t *testing.T) {
	a := New(1)
	a.Add(occurrence("a", base, ""))
	failed := a.Drain()

	a.Add(occurrence("b", base, ""))
	a.Restore(failed)

	groups := byHash(a.Drain())
	if groups["b"].Count != 1 || groups[OverflowHash("worker")].Count != 1 || groups["a"] != nil {
		t.Errorf("groups = %v", groups)
	}
}

func TestAsOverflowKeepsCounts(t *testing.T) {
	a := New(10)
	a.Add(occurrence("a", base, "1.0"))
	group := a.Drain()[0]

	overflow := AsOverflow(group)
	if overflow.Count != 1 || overflow.Hash != OverflowHash("worker") || overflow.Hours[base.Truncate(time.Hour)] != 1 {
		t.Errorf("overflow = %+v", overflow)
	}
	if group.Hash != "a" {
		t.Error("AsOverflow changed its input")
	}
}
