package store

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/aggregate"
	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/issue"
)

var base = time.Date(2026, 11, 20, 10, 15, 0, 0, time.UTC)

// The tests create and drop their own databases on the server named by
// ERROR_COLLECTOR_TEST_DATABASE (postgres://user:pass@host:port/?sslmode=disable).
func testDatabase(t *testing.T) DatabaseConfig {
	t.Helper()

	server := os.Getenv("ERROR_COLLECTOR_TEST_DATABASE")
	if server == "" {
		t.Skip("ERROR_COLLECTOR_TEST_DATABASE is not set")
	}

	cfg := DatabaseConfig{ServerURL: server, Name: fmt.Sprintf("error_collector_test_%d", time.Now().UnixNano())}
	t.Cleanup(func() {
		ctx := context.Background()
		conn, err := pgx.Connect(ctx, cfg.maintenanceDSN())
		if err != nil {
			return
		}
		defer conn.Close(ctx)
		_, _ = conn.Exec(ctx, `DROP DATABASE IF EXISTS `+pgx.Identifier{cfg.Name}.Sanitize()+` WITH (FORCE)`)
	})
	return cfg
}

func openTest(t *testing.T, cfg DatabaseConfig, maxGroups int) *Store {
	t.Helper()
	store, err := Open(context.Background(), Options{Database: cfg, MaxGroups: maxGroups})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(store.Close)
	return store
}

func drain(occurrences ...issue.Occurrence) []*aggregate.Group {
	a := aggregate.New(100)
	for _, occurrence := range occurrences {
		a.Add(occurrence)
	}
	return a.Drain()
}

func occurrence(hash string, at time.Time, release string) issue.Occurrence {
	return issue.Occurrence{
		Hash:      hash,
		Component: "worker",
		Level:     "error",
		Type:      "Error",
		Value:     "value of " + hash,
		Culprit:   "run (main.mjs)",
		Release:   release,
		Timestamp: at,
		Sample:    &issue.Sample{Timestamp: at.Format(time.RFC3339Nano), Level: "error"},
	}
}

func query(bucket Bucket) Query {
	return Query{Since: base.Add(-48 * time.Hour), Until: base.Add(48 * time.Hour), Bucket: bucket, Limit: 100}
}

func TestOpenCreatesTheDatabaseAndMigratesOnce(t *testing.T) {
	cfg := testDatabase(t)

	var wg sync.WaitGroup
	errs := make(chan error, 3)
	for range 3 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			store, err := Open(context.Background(), Options{Database: cfg, MaxGroups: 10})
			if err == nil {
				store.Close()
			}
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}

	store := openTest(t, cfg, 10)
	version, err := store.AppliedSchemaVersion(context.Background())
	if err != nil || version != SchemaVersion() {
		t.Fatalf("schema version = %d, %v", version, err)
	}
}

func TestFlushIsAdditive(t *testing.T) {
	ctx := context.Background()
	store := openTest(t, testDatabase(t), 10)

	first := drain(occurrence("a", base, "1.0"), occurrence("a", base.Add(time.Hour), "1.0"))
	second := drain(occurrence("a", base.Add(-24*time.Hour), "1.1"), occurrence("b", base, ""))
	for _, batch := range [][]*aggregate.Group{first, second} {
		if err := store.Flush(ctx, batch); err != nil {
			t.Fatal(err)
		}
	}

	groups, err := store.Groups(ctx, query(Hourly))
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 2 || groups[0].Hash != "a" {
		t.Fatalf("groups = %+v", groups)
	}

	a := groups[0]
	if a.TotalCount != 3 || a.WindowCount != 3 {
		t.Errorf("counts = %d / %d", a.TotalCount, a.WindowCount)
	}
	if !a.FirstSeen.Equal(base.Add(-24*time.Hour)) || !a.LastSeen.Equal(base.Add(time.Hour)) {
		t.Errorf("first/last = %v / %v", a.FirstSeen, a.LastSeen)
	}
	if len(a.FirstSample) == 0 || len(a.LatestSample) == 0 {
		t.Error("samples were not stored")
	}

	daily, err := store.GroupSeries(ctx, query(Daily), []int64{a.ID})
	if err != nil {
		t.Fatal(err)
	}
	var dailyTotal int64
	for _, point := range daily {
		dailyTotal += point.Count
	}
	if len(daily) != 2 || dailyTotal != 3 {
		t.Errorf("daily = %+v", daily)
	}

	releases, err := store.Releases(ctx, []int64{a.ID}, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(releases) != 2 || releases[0].Release != "1.0" || releases[0].Count != 2 {
		t.Errorf("releases = %+v", releases)
	}

	history, err := store.ReleaseHistory(ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 2 || history[0].Release != "1.1" || history[1].Release != "1.0" {
		t.Errorf("history = %+v", history)
	}
	if !history[1].FirstSeen.Equal(base) || !history[1].LastSeen.Equal(base.Add(time.Hour)) {
		t.Errorf("history of 1.0 = %+v", history[1])
	}

	latest, err := store.ReleaseHistory(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(latest) != 1 || latest[0].Release != "1.0" {
		t.Errorf("latest = %+v", latest)
	}

	components, err := store.ComponentSeries(ctx, query(Hourly))
	if err != nil {
		t.Fatal(err)
	}
	var total int64
	for _, point := range components {
		total += point.Count
	}
	if total != 4 {
		t.Errorf("component total = %d", total)
	}
}

func TestFlushCapsStoredGroups(t *testing.T) {
	ctx := context.Background()
	store := openTest(t, testDatabase(t), 2)

	if err := store.Flush(ctx, drain(occurrence("a", base, ""), occurrence("b", base, ""))); err != nil {
		t.Fatal(err)
	}

	batch := drain(occurrence("a", base, ""), occurrence("c", base, ""), occurrence("d", base, ""))
	if err := store.Flush(ctx, batch); err != nil {
		t.Fatal(err)
	}
	for _, group := range batch {
		if group.Type == aggregate.OverflowType {
			t.Fatal("Flush changed its input")
		}
	}

	groups, err := store.Groups(ctx, query(Hourly))
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int64{}
	for _, group := range groups {
		counts[group.Hash] = group.TotalCount
	}
	if counts["a"] != 2 || counts["b"] != 1 || counts[aggregate.OverflowHash("worker")] != 2 || len(counts) != 3 {
		t.Errorf("counts = %v", counts)
	}
	if groups[0].Hash != aggregate.OverflowHash("worker") {
		t.Errorf("overflow should be listed first, got %s", groups[0].Hash)
	}
}

func TestRetentionRemovesOldData(t *testing.T) {
	ctx := context.Background()
	store := openTest(t, testDatabase(t), 10)

	old := base.Add(-30 * 24 * time.Hour)
	batch := drain(occurrence("old", old, "1.0"), occurrence("recent", base, "1.0"), occurrence("recent", base.Add(-20*24*time.Hour), ""))
	if err := store.Flush(ctx, batch); err != nil {
		t.Fatal(err)
	}

	result, err := store.Retention(ctx, base.Add(time.Hour), 14*24*time.Hour, 25*24*time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if result.Skipped || result.Groups != 1 || result.HourlyBuckets != 2 || result.DailyBuckets != 1 || result.Releases != 1 {
		t.Errorf("result = %+v", result)
	}

	stats, err := store.Stats(ctx)
	if err != nil || stats.Groups != 1 {
		t.Errorf("stats = %+v, %v", stats, err)
	}

	var orphans int
	if err := store.pool.QueryRow(ctx, `SELECT count(*) FROM error_group_daily d LEFT JOIN error_group g ON g.id = d.group_id WHERE g.id IS NULL`).Scan(&orphans); err != nil || orphans != 0 {
		t.Errorf("orphaned daily buckets = %d, %v", orphans, err)
	}
}
