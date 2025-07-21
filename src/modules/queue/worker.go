package queue

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

func (q *Queue[_]) StartWorker(ctx context.Context, workerID string) error {
	for {
		select {
		case <-ctx.Done():
			log.Printf("Worker %s for queue %s shutting down", workerID, q.name)
			return ctx.Err()
		default:
			if err := q.processNextJob(ctx, workerID); err != nil {
				log.Printf("Worker %s error: %v", workerID, err)
			}
			time.Sleep(q.pollInterval)
		}
	}
}

func (q *Queue[_]) StartWorkers(ctx context.Context, numWorkers int) error {
	var wg sync.WaitGroup
	errChan := make(chan error, numWorkers)

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(workerNum int) {
			defer wg.Done()
			workerID := fmt.Sprintf("worker-%s-%d", q.name, workerNum)

			err := q.StartWorker(ctx, workerID)
			if err != nil && err != context.Canceled {
				errChan <- err
			}
		}(i)
	}

	// Wait for all workers to finish
	go func() {
		wg.Wait()
		close(errChan)
	}()

	for err := range errChan {
		return err
	}

	return nil
}
