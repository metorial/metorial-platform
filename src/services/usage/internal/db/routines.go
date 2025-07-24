package db

import (
	"context"
	"fmt"
	"log"
	"time"
)

func startBatchProcessor() {
	batchTicker = time.NewTicker(1 * time.Second)
	go func() {
		for range batchTicker.C {
			processBatch()
		}
	}()
}

func processBatch() {
	if !IsEnabled() {
		return
	}

	log.Println("Processing usage batch...")

	cacheMutex.Lock()
	if len(usageCache) == 0 {
		cacheMutex.Unlock()
		return
	}

	// Copy records and clear cache
	records := make([]interface{}, 0, len(usageCache))
	for _, record := range usageCache {
		records = append(records, *record)
	}
	clear(usageCache)
	cacheMutex.Unlock()

	fmt.Printf("Ingesting %d usage records\n", len(records))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if len(records) > 0 {
		_, err := collection.InsertMany(ctx, records)
		if err != nil {
			log.Printf("Failed to insert usage records: %v", err)
		}
	}
}
