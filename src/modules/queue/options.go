package queue

import "time"

type QueueOption[T any] func(*Queue[T])

func WithMaxRetries[T any](maxRetries int) QueueOption[T] {
	return func(q *Queue[T]) {
		q.maxRetries = maxRetries
	}
}

func WithRetryDelay[T any](delay time.Duration) QueueOption[T] {
	return func(q *Queue[T]) {
		q.retryDelay = delay
	}
}

func WithPollInterval[T any](interval time.Duration) QueueOption[T] {
	return func(q *Queue[T]) {
		q.pollInterval = interval
	}
}
