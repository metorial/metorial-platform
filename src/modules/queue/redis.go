package queue

import (
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

func createRedis(redisURL string) (*redis.Client, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	client := redis.NewClient(opt)

	err = client.Ping(ctx).Err()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return client, nil
}

func (q *Queue[_]) pendingKey() string {
	return fmt.Sprintf("queue:%s:pending", q.name)
}

func (q *Queue[_]) jobKeyPrefix() string {
	return fmt.Sprintf("queue:%s:jobs:", q.name)
}

func (q *Queue[_]) failedKey() string {
	return fmt.Sprintf("queue:%s:failed", q.name)
}
