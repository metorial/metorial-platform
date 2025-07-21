package queue

import (
	"context"
	"time"

	"github.com/go-redis/redis/v8"
)

type JobHandler[T any] func(ctx context.Context, job *Job[T]) error

type Queue[T any] struct {
	name       string
	client     *redis.Client
	handler    JobHandler[T]
	maxRetries int
	retryDelay time.Duration
}

func CreateQueue[T any](qm *QueueManager, name string, handler JobHandler[T], opts ...QueueOption[T]) *Queue[T] {
	qm.mu.Lock()
	defer qm.mu.Unlock()

	queue := &Queue[T]{
		name:       name,
		client:     qm.client,
		handler:    handler,
		maxRetries: 3,
		retryDelay: time.Minute,
	}

	for _, opt := range opts {
		opt(queue)
	}

	qm.queues[name] = queue

	queue.startPeriodicCleanup(context.Background(), time.Minute*30, DEFAULT_RETENTION_PERIOD)

	return queue
}

func (q *Queue[T]) Enqueue(ctx context.Context, data T) error {
	job := &Job[T]{
		ID:         generateJobID(),
		QueueName:  q.name,
		Data:       data,
		Retries:    0,
		MaxRetries: q.maxRetries,
		CreatedAt:  time.Now(),
		ProcessAt:  time.Now(),
	}

	return q.addJob(ctx, job)
}
