package observer

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/metorial/function-bay-deflector/internal/policy"
)

type captureSender struct {
	err     error
	batches []Batch
}

func (s *captureSender) Send(ctx context.Context, batch Batch) error {
	s.batches = append(s.batches, batch)
	return s.err
}

func TestRecorderAggregatesIntoThirtyMinuteBuckets(t *testing.T) {
	recorder := NewRecorder("deflector-1", 15*time.Minute)
	now := time.Date(2026, 5, 27, 12, 34, 0, 0, time.UTC)
	recorder.now = func() time.Time { return now }
	claims := policy.Claims{
		TenantID:          "tenant_123",
		FunctionID:        "function_123",
		FunctionVersionID: "functionVersion_123",
		EnclaveID:         "enclave_123",
	}

	recorder.Record(claims, "api.example.com", "203.0.113.10", "443")
	recorder.Record(claims, "api.example.com", "203.0.113.10", "443")

	sender := &captureSender{}
	if err := recorder.Flush(context.Background(), sender); err != nil {
		t.Fatal(err)
	}
	if len(sender.batches) != 1 {
		t.Fatalf("expected one batch, got %d", len(sender.batches))
	}
	records := sender.batches[0].Records
	if len(records) != 1 {
		t.Fatalf("expected one record, got %d", len(records))
	}
	if records[0].BucketStart != now.Truncate(30*time.Minute) {
		t.Fatalf("unexpected bucket start %s", records[0].BucketStart)
	}
	if records[0].Count != 2 {
		t.Fatalf("expected count 2, got %d", records[0].Count)
	}
}

func TestRecorderRetriesPendingBatch(t *testing.T) {
	recorder := NewRecorder("deflector-1", 15*time.Minute)
	recorder.now = func() time.Time {
		return time.Date(2026, 5, 27, 12, 0, 0, 0, time.UTC)
	}
	recorder.Record(policy.Claims{
		TenantID:          "tenant_123",
		FunctionID:        "function_123",
		FunctionVersionID: "functionVersion_123",
	}, "api.example.com", "203.0.113.10", "443")

	sender := &captureSender{err: errors.New("observer down")}
	if err := recorder.Flush(context.Background(), sender); err == nil {
		t.Fatal("expected first flush to fail")
	}
	sender.err = nil
	if err := recorder.Flush(context.Background(), sender); err != nil {
		t.Fatal(err)
	}
	if len(sender.batches) != 2 {
		t.Fatalf("expected two send attempts, got %d", len(sender.batches))
	}
	if sender.batches[0].ID != sender.batches[1].ID {
		t.Fatal("expected retry to reuse the same batch id")
	}
}

func TestRecorderDropsExpiredRecords(t *testing.T) {
	now := time.Date(2026, 5, 27, 12, 0, 0, 0, time.UTC)
	recorder := NewRecorder("deflector-1", 15*time.Minute)
	recorder.now = func() time.Time { return now }
	recorder.Record(policy.Claims{
		TenantID:          "tenant_123",
		FunctionID:        "function_123",
		FunctionVersionID: "functionVersion_123",
	}, "api.example.com", "203.0.113.10", "443")

	recorder.now = func() time.Time { return now.Add(16 * time.Minute) }
	sender := &captureSender{}
	if err := recorder.Flush(context.Background(), sender); err != nil {
		t.Fatal(err)
	}
	if len(sender.batches) != 0 {
		t.Fatal("expected expired records to be dropped before flush")
	}
}
