package queue

import (
	"context"
	"fmt"
	"sync"

	"github.com/go-redis/redis/v8"
)

type QueueManager struct {
	client *redis.Client
	queues map[string]RegisteredQueue
	mu     sync.RWMutex
}

type RegisteredQueue interface {
	GetQueueStats(ctx context.Context) (*QueueStats, error)
}

func NewQueueManager(uri string) (*QueueManager, error) {
	client, err := createRedis(uri)
	if err != nil {
		return nil, fmt.Errorf("failed to create Redis client: %w", err)
	}

	return &QueueManager{
		client: client,
		queues: make(map[string]RegisteredQueue),
	}, nil
}
