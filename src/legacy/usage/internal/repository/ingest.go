package repository

import (
	"context"
	"fmt"
	"log"
	"time"
)

type UsageRecord struct {
	EventType  string
	OwnerID    string
	EntityID   string
	EntityType string
	Count      int64
	Timestamp  time.Time
}

func (r *Repository) IngestUsage(record UsageRecord) {
	hash := fmt.Sprintf("%s:%s:%s", record.OwnerID, record.EntityID, record.EventType)

	r.cacheMutex.Lock()
	defer r.cacheMutex.Unlock()

	if existing, ok := r.usageCache[hash]; ok {
		existing.Count += record.Count
	} else {
		record.Timestamp = time.Now()
		r.usageCache[hash] = &record
	}
}

func (r *Repository) startBatchProcessor() {
	batchTicker := time.NewTicker(5 * time.Second)
	go func() {
		for range batchTicker.C {
			r.processBatch()
		}
	}()
}

func (r *Repository) processBatch() {
	r.cacheMutex.Lock()
	if len(r.usageCache) == 0 {
		r.cacheMutex.Unlock()
		return
	}

	// Copy records and clear cache
	records := make([]*UsageRecord, 0, len(r.usageCache))
	for _, record := range r.usageCache {
		records = append(records, record)
	}
	clear(r.usageCache)
	r.cacheMutex.Unlock()

	fmt.Printf("Ingesting %d usage records\n", len(records))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if len(records) > 0 {
		err := r.store.IngestUsage(ctx, records)
		if err != nil {
			log.Printf("Failed to insert usage records: %v", err)
		}
	}
}
