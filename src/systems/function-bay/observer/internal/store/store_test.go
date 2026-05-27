package store

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/metorial/function-bay-observer/internal/api"
)

func TestIngestAggregatesAndDeduplicatesBatches(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "observer.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	bucketStart := time.Date(2026, 5, 27, 12, 0, 0, 0, time.UTC)
	firstSeen := bucketStart.Add(5 * time.Minute)
	lastSeen := bucketStart.Add(10 * time.Minute)
	batch := api.IngestBatch{
		ID:                  "deflector-1:1",
		DeflectorInstanceID: "deflector-1",
		Records: []api.Observation{
			{
				BucketStart:         bucketStart,
				TenantID:            "tenant_123",
				FunctionID:          "function_123",
				EffectiveFunctionID: "function_override_123",
				EnclaveID:           "enclave_123",
				Hostname:            "api.example.com",
				IP:                  "203.0.113.10",
				Port:                443,
				Count:               2,
				FirstSeenAt:         firstSeen,
				LastSeenAt:          lastSeen,
			},
		},
	}

	inserted, err := store.Ingest(context.Background(), batch)
	if err != nil {
		t.Fatal(err)
	}
	if !inserted {
		t.Fatal("expected first batch to be inserted")
	}

	inserted, err = store.Ingest(context.Background(), batch)
	if err != nil {
		t.Fatal(err)
	}
	if inserted {
		t.Fatal("expected duplicate batch to be ignored")
	}

	records, err := store.Query(context.Background(), Query{TenantID: "tenant_123"})
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("expected one record, got %d", len(records))
	}
	if records[0].Count != 2 {
		t.Fatalf("expected count to remain 2 after duplicate batch, got %d", records[0].Count)
	}
}

func TestIngestUpsertsMatchingObservationKeys(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "observer.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	bucketStart := time.Date(2026, 5, 27, 12, 0, 0, 0, time.UTC)
	makeBatch := func(id string, count int64) api.IngestBatch {
		return api.IngestBatch{
			ID:                  id,
			DeflectorInstanceID: "deflector-1",
			Records: []api.Observation{
				{
					BucketStart: bucketStart,
					TenantID:    "tenant_123",
					FunctionID:  "function_123",
					EnclaveID:   "enclave_123",
					Hostname:    "api.example.com",
					IP:          "203.0.113.10",
					Port:        443,
					Count:       count,
					FirstSeenAt: bucketStart.Add(time.Minute),
					LastSeenAt:  bucketStart.Add(2 * time.Minute),
				},
			},
		}
	}

	if _, err := store.Ingest(context.Background(), makeBatch("deflector-1:1", 2)); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Ingest(context.Background(), makeBatch("deflector-1:2", 3)); err != nil {
		t.Fatal(err)
	}

	records, err := store.Query(context.Background(), Query{
		TenantID:    "tenant_123",
		EnclaveIDs:  []string{"enclave_123"},
		FunctionIDs: []string{"function_123"},
		Hostnames:   []string{"api.example.com"},
		IPs:         []string{"203.0.113.10"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("expected one aggregated record, got %d", len(records))
	}
	if records[0].Count != 5 {
		t.Fatalf("expected upserted count to be 5, got %d", records[0].Count)
	}
}

func TestQueryAggregatesIntoRequestedInterval(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "observer.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	makeRecord := func(bucketStart time.Time, count int64) api.Observation {
		return api.Observation{
			BucketStart: bucketStart,
			TenantID:    "tenant_123",
			FunctionID:  "function_123",
			EnclaveID:   "enclave_123",
			Hostname:    "api.example.com",
			IP:          "203.0.113.10",
			Port:        443,
			Count:       count,
			FirstSeenAt: bucketStart,
			LastSeenAt:  bucketStart.Add(time.Minute),
		}
	}
	bucketStart := time.Date(2026, 5, 27, 12, 0, 0, 0, time.UTC)
	_, err = store.Ingest(context.Background(), api.IngestBatch{
		ID:                  "deflector-1:interval",
		DeflectorInstanceID: "deflector-1",
		Records: []api.Observation{
			makeRecord(bucketStart, 2),
			makeRecord(bucketStart.Add(30*time.Minute), 3),
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	records, err := store.Query(context.Background(), Query{
		TenantID:        "tenant_123",
		IntervalMinutes: 60,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("expected one rolled up record, got %d", len(records))
	}
	if records[0].BucketStart != bucketStart {
		t.Fatalf("unexpected bucket start %s", records[0].BucketStart)
	}
	if records[0].Count != 5 {
		t.Fatalf("expected count 5, got %d", records[0].Count)
	}
}

func TestCleanupBeforeDeletesLogsOlderThanCutoff(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "observer.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	now := time.Date(2026, 5, 27, 12, 0, 0, 0, time.UTC)
	makeRecord := func(bucketStart time.Time, hostname string) api.Observation {
		return api.Observation{
			BucketStart: bucketStart,
			TenantID:    "tenant_123",
			FunctionID:  "function_123",
			Hostname:    hostname,
			IP:          "203.0.113.10",
			Port:        443,
			Count:       1,
			FirstSeenAt: bucketStart,
			LastSeenAt:  bucketStart.Add(time.Minute),
		}
	}

	_, err = store.Ingest(context.Background(), api.IngestBatch{
		ID:                  "deflector-1:old",
		DeflectorInstanceID: "deflector-1",
		Records: []api.Observation{
			makeRecord(now.Add(-8*24*time.Hour), "old.example.com"),
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.Ingest(context.Background(), api.IngestBatch{
		ID:                  "deflector-1:recent",
		DeflectorInstanceID: "deflector-1",
		Records: []api.Observation{
			makeRecord(now.Add(-6*24*time.Hour), "recent.example.com"),
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	deleted, err := store.CleanupBefore(context.Background(), now.Add(-7*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if deleted != 1 {
		t.Fatalf("expected one deleted record, got %d", deleted)
	}

	records, err := store.Query(context.Background(), Query{TenantID: "tenant_123"})
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("expected one remaining record, got %d", len(records))
	}
	if records[0].Hostname != "recent.example.com" {
		t.Fatalf("unexpected remaining hostname %q", records[0].Hostname)
	}
}
