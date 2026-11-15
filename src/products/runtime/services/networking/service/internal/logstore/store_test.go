package logstore

import (
	"context"
	"crypto/rand"
	"net/url"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

// Set NETWORK_LOGS_TEST_DATABASE to a superuser URL, e.g.
// postgres://postgres:test@127.0.0.1:5432/?sslmode=disable. Each test gets its own database.
func testConfig(t *testing.T) Config {
	t.Helper()

	raw := os.Getenv("NETWORK_LOGS_TEST_DATABASE")
	if raw == "" {
		t.Skip("NETWORK_LOGS_TEST_DATABASE is not set")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	password, _ := parsed.User.Password()
	cfg := Config{
		Host:     parsed.Hostname(),
		Port:     parsed.Port(),
		Name:     "netlogs_test_" + strings.ToLower(rand.Text()[:12]),
		Username: parsed.User.Username(),
		Password: password,
		SSLMode:  parsed.Query().Get("sslmode"),
	}

	t.Cleanup(func() {
		ctx := context.Background()
		conn, err := pgx.Connect(ctx, cfg.DSN("postgres"))
		if err != nil {
			return
		}
		defer conn.Close(ctx)
		_, _ = conn.Exec(ctx, `DROP DATABASE IF EXISTS `+pgx.Identifier{cfg.Name}.Sanitize()+` WITH (FORCE)`)
	})
	return cfg
}

func openTestStore(t *testing.T, cfg Config) *Store {
	t.Helper()
	store, err := Open(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(store.Close)
	return store
}

var bucket = time.Date(2026, 11, 13, 10, 0, 0, 0, time.UTC)

func functionRecord(hostname string, decision string) Record {
	return Record{
		BucketStart:         bucket,
		TenantID:            "ten_1",
		FunctionID:          "fn_1",
		EffectiveFunctionID: "fn_eff_1",
		EnclaveID:           "enc_1",
		Hostname:            hostname,
		IP:                  "93.184.216.34",
		Port:                443,
		Decision:            decision,
		Source:              SourceKnative,
		Count:               2,
		FirstSeenAt:         bucket.Add(time.Minute),
		LastSeenAt:          bucket.Add(2 * time.Minute),
	}
}

func TestIngestIsIdempotentAndMerges(t *testing.T) {
	store := openTestStore(t, testConfig(t))
	ctx := context.Background()

	build := Record{
		BucketStart: bucket, BuildRunID: "brun_1", Hostname: "registry.npmjs.org", IP: "104.16.0.1", Port: 443,
		Decision: DecisionAllowed, Source: SourceBuild, Count: 5, FirstSeenAt: bucket, LastSeenAt: bucket.Add(time.Minute),
	}
	resolveDenial := functionRecord("evil.example", DecisionDenied)
	resolveDenial.Port = 0

	inserted, err := store.Ingest(ctx, Batch{ID: "gw:1", InstanceID: "gw", Records: []Record{
		functionRecord("example.com", DecisionAllowed),
		functionRecord("example.com", DecisionDenied),
		resolveDenial,
		build,
	}})
	if err != nil || !inserted {
		t.Fatalf("inserted=%v err=%v", inserted, err)
	}

	again, err := store.Ingest(ctx, Batch{ID: "gw:1", InstanceID: "gw", Records: []Record{functionRecord("example.com", DecisionAllowed)}})
	if err != nil || again {
		t.Fatalf("replay inserted=%v err=%v", again, err)
	}

	later := functionRecord("example.com", DecisionAllowed)
	later.Count = 3
	later.FirstSeenAt = bucket.Add(30 * time.Second)
	later.LastSeenAt = bucket.Add(10 * time.Minute)
	if _, err := store.Ingest(ctx, Batch{ID: "gw:2", InstanceID: "gw", Records: []Record{later}}); err != nil {
		t.Fatal(err)
	}

	records, err := store.List(ctx, Query{TenantID: "ten_1", Decision: DecisionAllowed})
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("records %+v", records)
	}
	merged := records[0]
	if merged.Count != 5 || !merged.FirstSeenAt.Equal(bucket.Add(30*time.Second)) || !merged.LastSeenAt.Equal(bucket.Add(10*time.Minute)) {
		t.Fatalf("merged %+v", merged)
	}
	if merged.Source != SourceKnative || merged.EnclaveID != "enc_1" || merged.EffectiveFunctionID != "fn_eff_1" || merged.BuildRunID != "" {
		t.Fatalf("fields %+v", merged)
	}

	denied, err := store.List(ctx, Query{TenantID: "ten_1", Decision: DecisionDenied})
	if err != nil || len(denied) != 2 {
		t.Fatalf("denied %+v err %v", denied, err)
	}

	builds, err := store.List(ctx, Query{Hostnames: []string{"registry.npmjs.org"}})
	if err != nil || len(builds) != 1 || builds[0].BuildRunID != "brun_1" || builds[0].Source != SourceBuild || builds[0].Count != 5 {
		t.Fatalf("builds %+v err %v", builds, err)
	}
}

func TestIngestMergesDuplicatesWithinBatch(t *testing.T) {
	store := openTestStore(t, testConfig(t))
	ctx := context.Background()

	first := functionRecord("example.com", DecisionAllowed)
	second := functionRecord("example.com", DecisionAllowed)
	second.LastSeenAt = bucket.Add(20 * time.Minute)
	if _, err := store.Ingest(ctx, Batch{ID: "b", Records: []Record{first, second}}); err != nil {
		t.Fatal(err)
	}

	records, err := store.List(ctx, Query{TenantID: "ten_1"})
	if err != nil || len(records) != 1 || records[0].Count != 4 || !records[0].LastSeenAt.Equal(bucket.Add(20*time.Minute)) {
		t.Fatalf("records %+v err %v", records, err)
	}
}

func TestIngestRejectsInvalidRecordsAtomically(t *testing.T) {
	store := openTestStore(t, testConfig(t))
	ctx := context.Background()

	invalid := map[string]func(*Record){
		"unknown decision":     func(r *Record) { r.Decision = "maybe" },
		"unknown source":       func(r *Record) { r.Source = "ec2" },
		"function without id":  func(r *Record) { r.FunctionID = "" },
		"build without run id": func(r *Record) { r.Source = SourceBuild },
		"missing hostname":     func(r *Record) { r.Hostname = "" },
		"port out of range":    func(r *Record) { r.Port = 70000 },
		"negative port":        func(r *Record) { r.Port = -1 },
	}
	for name, mutate := range invalid {
		bad := functionRecord("bad.example", DecisionAllowed)
		mutate(&bad)
		if _, err := store.Ingest(ctx, Batch{ID: "bad-" + name, Records: []Record{functionRecord("ok.example", DecisionAllowed), bad}}); err == nil {
			t.Fatalf("%s: expected an error", name)
		}
	}

	records, err := store.List(ctx, Query{})
	if err != nil || len(records) != 0 {
		t.Fatalf("records %+v err %v", records, err)
	}
	if inserted, err := store.Ingest(ctx, Batch{ID: "bad-unknown decision"}); err != nil || !inserted {
		t.Fatalf("rejected batch id was consumed: inserted=%v err=%v", inserted, err)
	}
}

func TestListFiltersAndIntervals(t *testing.T) {
	store := openTestStore(t, testConfig(t))
	ctx := context.Background()

	a := functionRecord("a.example", DecisionAllowed)
	b := functionRecord("b.example", DecisionAllowed)
	b.BucketStart = bucket.Add(30 * time.Minute)
	b.IP = "1.1.1.1"
	c := functionRecord("a.example", DecisionAllowed)
	c.BucketStart = bucket.Add(30 * time.Minute)
	c.FirstSeenAt = c.BucketStart
	c.LastSeenAt = c.BucketStart.Add(time.Minute)
	otherTenant := functionRecord("a.example", DecisionAllowed)
	otherTenant.TenantID = "ten_2"
	otherEnclave := functionRecord("a.example", DecisionAllowed)
	otherEnclave.EnclaveID = "enc_2"
	otherEnclave.FunctionID = "fn_2"

	if _, err := store.Ingest(ctx, Batch{ID: "x", Records: []Record{a, b, c, otherTenant, otherEnclave}}); err != nil {
		t.Fatal(err)
	}

	count := func(q Query) int {
		t.Helper()
		records, err := store.List(ctx, q)
		if err != nil {
			t.Fatal(err)
		}
		return len(records)
	}

	if got := count(Query{TenantID: "ten_1"}); got != 4 {
		t.Fatalf("tenant: %d", got)
	}
	if got := count(Query{TenantID: "ten_1", Hostnames: []string{"a.example"}}); got != 3 {
		t.Fatalf("hostname: %d", got)
	}
	if got := count(Query{TenantID: "ten_1", IPs: []string{"1.1.1.1"}}); got != 1 {
		t.Fatalf("ip: %d", got)
	}
	if got := count(Query{TenantID: "ten_1", EnclaveIDs: []string{"enc_2", ""}}); got != 1 {
		t.Fatalf("enclave: %d", got)
	}
	if got := count(Query{TenantID: "ten_1", FunctionIDs: []string{"fn_1"}}); got != 3 {
		t.Fatalf("function: %d", got)
	}
	if got := count(Query{TenantID: "ten_1", From: bucket.Add(30 * time.Minute)}); got != 2 {
		t.Fatalf("from: %d", got)
	}
	if got := count(Query{TenantID: "ten_1", To: bucket.Add(30 * time.Minute)}); got != 2 {
		t.Fatalf("to: %d", got)
	}

	hourly, err := store.List(ctx, Query{TenantID: "ten_1", Hostnames: []string{"a.example"}, EnclaveIDs: []string{"enc_1"}, IntervalMinutes: 60})
	if err != nil || len(hourly) != 1 || hourly[0].Count != 4 || !hourly[0].BucketStart.Equal(bucket) {
		t.Fatalf("hourly %+v err %v", hourly, err)
	}

	newestFirst, _ := store.List(ctx, Query{TenantID: "ten_1", EnclaveIDs: []string{"enc_1"}})
	if !newestFirst[0].BucketStart.After(newestFirst[len(newestFirst)-1].BucketStart) {
		t.Fatalf("order %+v", newestFirst)
	}

	if _, err := store.List(ctx, Query{IntervalMinutes: 45}); err != ErrInvalidInterval {
		t.Fatalf("interval error %v", err)
	}
}

func TestCleanupBefore(t *testing.T) {
	store := openTestStore(t, testConfig(t))
	ctx := context.Background()

	old := functionRecord("old.example", DecisionAllowed)
	old.BucketStart = bucket.Add(-48 * time.Hour)
	if _, err := store.Ingest(ctx, Batch{ID: "c", Records: []Record{old, functionRecord("new.example", DecisionAllowed)}}); err != nil {
		t.Fatal(err)
	}

	deleted, err := store.CleanupBefore(ctx, bucket.Add(-time.Hour))
	if err != nil || deleted != 1 {
		t.Fatalf("deleted=%d err=%v", deleted, err)
	}
	records, _ := store.List(ctx, Query{})
	if len(records) != 1 || records[0].Hostname != "new.example" {
		t.Fatalf("records %+v", records)
	}
}

// legacyObserverSchema is what the observer's gorm AutoMigrate created.
const legacyObserverSchema = `
CREATE TABLE "ingest_batches" ("id" text,"deflector_instance_id" text NOT NULL,"received_at" bigint NOT NULL,PRIMARY KEY ("id"));
CREATE TABLE "network_observations" ("bucket_start" bigint,"tenant_id" text,"enclave_id" text,"function_id" text,"effective_function_id" text,"hostname" text,"ip" text,"port" bigint,"count" bigint NOT NULL,"first_seen_at" bigint NOT NULL,"last_seen_at" bigint NOT NULL,PRIMARY KEY ("bucket_start","tenant_id","enclave_id","function_id","effective_function_id","hostname","ip","port"));
INSERT INTO ingest_batches VALUES ('deflector-1:1', 'deflector-1', 1794000000);
INSERT INTO network_observations VALUES (1794564000, 'ten_1', 'enc_1', 'fn_1', 'fn_eff_1', 'example.com', '93.184.216.34', 443, 7, 1794564060, 1794564120);
INSERT INTO network_observations VALUES (1794564000, 'ten_1', '', 'fn_1', '', 'api.example.com', '93.184.216.35', 443, 1, 1794564060, 1794564060);
`

func createLegacyDatabase(t *testing.T, cfg Config) {
	t.Helper()
	ctx := context.Background()

	admin, err := pgx.Connect(ctx, cfg.DSN("postgres"))
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close(ctx)
	if _, err := admin.Exec(ctx, `CREATE DATABASE `+pgx.Identifier{cfg.Name}.Sanitize()); err != nil {
		t.Fatal(err)
	}

	conn, err := pgx.Connect(ctx, cfg.DSN(cfg.Name))
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	if _, err := conn.Exec(ctx, legacyObserverSchema); err != nil {
		t.Fatal(err)
	}
}

func primaryKey(t *testing.T, store *Store) (string, []string) {
	t.Helper()
	conn, err := store.pool.Acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Release()
	name, columns, err := currentPrimaryKey(context.Background(), conn)
	if err != nil {
		t.Fatal(err)
	}
	return name, columns
}

func TestMigrateLegacyObserverDatabase(t *testing.T) {
	cfg := testConfig(t)
	createLegacyDatabase(t, cfg)
	ctx := context.Background()

	store := openTestStore(t, cfg)

	name, columns := primaryKey(t, store)
	if name != "network_observations_pkey" || !slices.Equal(columns, primaryKeyColumns) {
		t.Fatalf("primary key %s %v", name, columns)
	}

	records, err := store.List(ctx, Query{TenantID: "ten_1"})
	if err != nil || len(records) != 2 {
		t.Fatalf("legacy rows %+v err %v", records, err)
	}
	for _, record := range records {
		if record.Decision != DecisionAllowed || record.Source != SourceLambda || record.BuildRunID != "" {
			t.Fatalf("legacy defaults %+v", record)
		}
	}

	if inserted, err := store.Ingest(ctx, Batch{ID: "deflector-1:1"}); err != nil || inserted {
		t.Fatalf("legacy batch ids must still dedupe: inserted=%v err=%v", inserted, err)
	}

	sameKey := Record{
		BucketStart: time.Unix(1794564000, 0), TenantID: "ten_1", EnclaveID: "enc_1", FunctionID: "fn_1", EffectiveFunctionID: "fn_eff_1",
		Hostname: "example.com", IP: "93.184.216.34", Port: 443, Decision: DecisionAllowed, Source: SourceLambda, Count: 3,
		FirstSeenAt: time.Unix(1794564000, 0), LastSeenAt: time.Unix(1794564500, 0),
	}
	deniedSameKey := sameKey
	deniedSameKey.Decision = DecisionDenied
	if _, err := store.Ingest(ctx, Batch{ID: "gw:1", Records: []Record{sameKey, deniedSameKey}}); err != nil {
		t.Fatal(err)
	}

	allowed, _ := store.List(ctx, Query{TenantID: "ten_1", Hostnames: []string{"example.com"}, Decision: DecisionAllowed})
	if len(allowed) != 1 || allowed[0].Count != 10 || allowed[0].FirstSeenAt.Unix() != 1794564000 || allowed[0].LastSeenAt.Unix() != 1794564500 {
		t.Fatalf("merged legacy row %+v", allowed)
	}
	denied, _ := store.List(ctx, Query{TenantID: "ten_1", Decision: DecisionDenied})
	if len(denied) != 1 || denied[0].Count != 3 {
		t.Fatalf("denied %+v", denied)
	}

	if err := store.Migrate(ctx); err != nil {
		t.Fatalf("second migration: %v", err)
	}
}

func TestMigrateConcurrentReplicas(t *testing.T) {
	cfg := testConfig(t)
	createLegacyDatabase(t, cfg)

	var wg sync.WaitGroup
	errs := make(chan error, 4)
	for range 4 {
		wg.Go(func() {
			store, err := Open(context.Background(), cfg)
			if err != nil {
				errs <- err
				return
			}
			store.Close()
		})
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatal(err)
	}

	store := openTestStore(t, cfg)
	if _, columns := primaryKey(t, store); !slices.Equal(columns, primaryKeyColumns) {
		t.Fatalf("primary key %v", columns)
	}
}

func TestMigrateRecoversFromInterruptedIndexBuild(t *testing.T) {
	cfg := testConfig(t)
	createLegacyDatabase(t, cfg)
	ctx := context.Background()

	conn, err := pgx.Connect(ctx, cfg.DSN(cfg.Name))
	if err != nil {
		t.Fatal(err)
	}
	_, err = conn.Exec(ctx, `ALTER TABLE network_observations ADD COLUMN decision text NOT NULL DEFAULT 'allowed', ADD COLUMN source text NOT NULL DEFAULT 'lambda', ADD COLUMN build_run_id text NOT NULL DEFAULT ''`)
	if err == nil {
		_, err = conn.Exec(ctx, `CREATE UNIQUE INDEX `+newPrimaryKeyIndex+` ON network_observations (`+primaryKeyList+`)`)
	}
	if err == nil {
		_, err = conn.Exec(ctx, `UPDATE pg_index SET indisvalid = false WHERE indexrelid = '`+newPrimaryKeyIndex+`'::regclass`)
	}
	conn.Close(ctx)
	if err != nil {
		t.Fatal(err)
	}

	store := openTestStore(t, cfg)
	if name, columns := primaryKey(t, store); name != "network_observations_pkey" || !slices.Equal(columns, primaryKeyColumns) {
		t.Fatalf("primary key %s %v", name, columns)
	}
}

func TestOpenCreatesFreshSchema(t *testing.T) {
	store := openTestStore(t, testConfig(t))
	if name, columns := primaryKey(t, store); name != "network_observations_pkey" || !slices.Equal(columns, primaryKeyColumns) {
		t.Fatalf("primary key %s %v", name, columns)
	}
}
