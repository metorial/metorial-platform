package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand/v2"
	"time"

	"github.com/go-redis/redis/v8"
)

type Job[T any] struct {
	ID         string    `json:"id"`
	QueueName  string    `json:"queue_name"`
	Data       T         `json:"data"`
	Retries    int       `json:"retries"`
	MaxRetries int       `json:"max_retries"`
	CreatedAt  time.Time `json:"created_at"`
	ProcessAt  time.Time `json:"process_at"`
}

const LOCK_DURATION_SECONDS = 45

func (q *Queue[T]) processNextJob(ctx context.Context, workerID string) error {
	// Use Lua script to atomically move job from pending to processing
	luaScript := `
		local pending_key = KEYS[1]
		local processing_key = KEYS[2]
		local current_time = tonumber(ARGV[1])
		local worker_id = ARGV[2]
		local lock_duration = tonumber(ARGV[3])
		local lock_value = ARGV[4]

		-- Get jobs that are ready to process (score <= current_time)
		local jobs = redis.call('ZRANGEBYSCORE', pending_key, '-inf', current_time, 'LIMIT', 0, 1)
		
		if #jobs == 0 then
			return nil
		end

		local job_data = jobs[1]
		
		-- Remove from pending queue
		redis.call('ZREM', pending_key, job_data)
		
		-- Add to processing queue with lock expiration
		local lock_score = current_time + lock_duration
		redis.call('ZADD', processing_key, lock_score, lock_value)
		
		return job_data
	`

	currentTime := time.Now().Unix()
	lockDuration := int64(LOCK_DURATION_SECONDS)
	lockValue := fmt.Sprintf("%s:%d", workerID, rand.Int64())

	result, err := q.client.Eval(ctx, luaScript, []string{
		q.pendingKey(),
		q.processingKey(),
	}, currentTime, workerID, lockDuration, lockValue).Result()

	if err != nil {
		return fmt.Errorf("failed to get job: %w", err)
	}

	if result == nil {
		return nil // No jobs available
	}

	jobData := result.(string)
	var job Job[T]
	if err := json.Unmarshal([]byte(jobData), &job); err != nil {
		return fmt.Errorf("failed to unmarshal job: %w", err)
	}

	// Set up lock extension
	lock := newLockManager(
		q.client,
		q.processingKey(),
		lockValue,
		LOCK_DURATION_SECONDS*time.Second,
	)

	lock.start()

	// Ensure we always stop the extender and clean up
	defer func() {
		lock.stop()
		q.client.ZRem(context.Background(), q.processingKey(), lockValue)
	}()

	// Process the job with panic recovery
	var jobErr error
	func() {
		defer func() {
			if r := recover(); r != nil {
				jobErr = fmt.Errorf("job panicked: %v", r)
				log.Printf("Job %s panicked: %v", job.ID, r)
			}
		}()

		jobErr = q.handler(ctx, &job)
	}()

	if jobErr != nil {
		log.Printf("Job %s failed: %v", job.ID, jobErr)
		return q.handleFailedJob(ctx, &job, jobErr)
	}

	// Remove job from pending queue
	err = q.client.ZRem(ctx, q.processingKey(), lockValue).Err()
	if err != nil {
		return fmt.Errorf("failed to remove job from processing queue: %w", err)
	}

	return nil
}

func (q *Queue[T]) handleFailedJob(ctx context.Context, job *Job[T], jobErr error) error {
	job.Retries++

	if job.Retries <= job.MaxRetries {
		// Retry with exponential backoff
		delay := time.Duration(job.Retries*job.Retries) * q.retryDelay
		job.ProcessAt = time.Now().Add(delay)

		jobData := mustMarshal(job)
		score := float64(job.ProcessAt.Unix())

		log.Printf("Retrying job %s (attempt %d/%d) in %v", job.ID, job.Retries, job.MaxRetries, delay)
		return q.client.ZAdd(ctx, q.pendingKey(), &redis.Z{
			Score:  score,
			Member: string(jobData),
		}).Err()
	}

	// Max retries exceeded, move to failed queue
	log.Printf("Job %s failed permanently after %d attempts", job.ID, job.Retries)

	failedJob := map[string]interface{}{
		"job":       job,
		"error":     jobErr.Error(),
		"failed_at": time.Now(),
	}

	failedData := mustMarshal(failedJob)
	failedAt := time.Now().Unix()
	return q.client.ZAdd(ctx, q.failedKey(), &redis.Z{
		Score:  float64(failedAt),
		Member: string(failedData),
	}).Err()
}
