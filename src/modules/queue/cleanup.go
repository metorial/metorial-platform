package queue

import (
	"context"
	"fmt"
	"log"
	"time"
)

type RetentionPeriod struct {
	Failed     time.Duration
	Processing time.Duration
	// Pending    time.Duration
}

var DEFAULT_RETENTION_PERIOD = RetentionPeriod{
	Failed:     7 * 24 * time.Hour,
	Processing: 1 * time.Hour,
	// Pending:    30 * 24 * time.Hour,
}

func (q *Queue[_]) cleanupOldJobs(ctx context.Context, retentionPeriods RetentionPeriod) error {
	currentTime := time.Now().Unix()

	var totalCleaned int64

	failedRetention := retentionPeriods.Failed
	processingRetention := retentionPeriods.Processing
	// pendingRetention := retentionPeriods.Pending

	cutoffTime := currentTime - int64(failedRetention.Seconds())
	cleaned, err := q.client.ZRemRangeByScore(ctx, q.failedKey(), "-inf", fmt.Sprintf("%d", cutoffTime)).Result()
	if err != nil {
		log.Printf("Failed to clean up old failed jobs: %v", err)
	} else {
		totalCleaned += cleaned
	}

	cutoffTime = currentTime - int64(processingRetention.Seconds())
	cleaned, err = q.client.ZRemRangeByScore(ctx, q.processingKey(), "-inf", fmt.Sprintf("%d", cutoffTime)).Result()
	if err != nil {
		log.Printf("Failed to clean up old processing jobs: %v", err)
	} else {
		totalCleaned += cleaned
	}

	// cutoffTime = currentTime - int64(pendingRetention.Seconds())
	// cleaned, err = q.client.ZRemRangeByScore(ctx, q.pendingKey(), "-inf", fmt.Sprintf("%d", cutoffTime)).Result()
	// if err != nil {
	// 	log.Printf("Failed to clean up old pending jobs: %v", err)
	// } else {
	// 	totalCleaned += cleaned
	// }

	if totalCleaned > 0 {
		log.Printf("Total jobs cleaned up: %d", totalCleaned)
	}

	return nil
}

func (q *Queue[_]) startPeriodicCleanup(ctx context.Context, interval time.Duration, retentionPeriods RetentionPeriod) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				log.Printf("Stopping periodic cleanup")
				return
			case <-ticker.C:
				if err := q.cleanupOldJobs(ctx, retentionPeriods); err != nil {
					log.Printf("Error during periodic cleanup: %v", err)
				}
			}
		}
	}()
}
