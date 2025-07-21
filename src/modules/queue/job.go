package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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

const LOCK_DURATION_SECONDS = 60

func (q *Queue[T]) processNextJob(ctx context.Context, workerID string) error {
	// Use Lua script to atomically move job from pending to processing
	luaScript := `
		local pending_key = KEYS[1]
		local job_key_prefix = KEYS[2]
		local current_time = tonumber(ARGV[1])
		local worker_id = ARGV[2]
		local lock_duration = tonumber(ARGV[3])

		-- Get jobs that are ready to process (score <= current_time)
		local jobs = redis.call('ZRANGEBYSCORE', pending_key, '-inf', current_time, 'LIMIT', 0, 1)
		
		if #jobs == 0 then
			return nil
		end

		local job_id = jobs[1]
		
		-- Lock the job by changing its score to the current time + lock duration
		local new_score = current_time + lock_duration
		redis.call('ZADD', pending_key, new_score, job_id)

		local job_data = redis.call('GET', job_key_prefix .. job_id)
		if not job_data then
			return nil
		end
		
		return {job_data, job_id}
	`

	currentTime := time.Now().Unix()
	lockDuration := int64(LOCK_DURATION_SECONDS)

	result, err := q.client.Eval(ctx, luaScript, []string{
		q.pendingKey(),
		q.jobKeyPrefix(),
	}, currentTime, workerID, lockDuration).Result()

	if err != nil {
		return fmt.Errorf("failed to get job: %w", err)
	}

	if result == nil {
		time.Sleep(1 * time.Second) // No jobs available, wait before retrying
		return nil
	}

	values := result.([]any)
	jobData := values[0].(string)
	jobId := values[1].(string)

	var job Job[T]
	if err := json.Unmarshal([]byte(jobData), &job); err != nil {
		return fmt.Errorf("failed to unmarshal job: %w", err)
	}

	// Set up lock extension
	lock := newLockManager(
		q.client,
		q.pendingKey(),
		jobId,
		LOCK_DURATION_SECONDS*time.Second,
	)

	lock.start()

	// Ensure we always stop the extender and clean up
	defer func() {
		lock.stop()
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
	err = q.client.ZRem(ctx, q.pendingKey(), jobId).Err()
	if err != nil {
		return fmt.Errorf("failed to remove job from processing queue: %w", err)
	}

	err = q.client.Del(ctx, q.jobKeyPrefix()+job.ID).Err()
	if err != nil {
		return fmt.Errorf("failed to delete job data: %w", err)
	}

	return nil
}

func (q *Queue[T]) handleFailedJob(ctx context.Context, job *Job[T], jobErr error) error {
	job.Retries++

	if job.Retries <= job.MaxRetries {
		// Retry with exponential backoff
		delay := time.Duration(job.Retries*job.Retries) * q.retryDelay
		job.ProcessAt = time.Now().Add(delay)

		score := float64(job.ProcessAt.Unix())

		log.Printf("Retrying job %s (attempt %d/%d) in %v", job.ID, job.Retries, job.MaxRetries, delay)
		return q.client.ZAdd(ctx, q.pendingKey(), &redis.Z{
			Score:  score,
			Member: job.ID,
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

func (q *Queue[T]) addJob(ctx context.Context, job *Job[T]) error {
	jobData := mustMarshal(job)
	score := float64(job.ProcessAt.Unix())

	err := q.client.Set(ctx, q.jobKeyPrefix()+job.ID, jobData, 0).Err()
	if err != nil {
		return fmt.Errorf("failed to set job data: %w", err)
	}

	return q.client.ZAdd(ctx, q.pendingKey(), &redis.Z{
		Score:  score,
		Member: job.ID,
	}).Err()
}
