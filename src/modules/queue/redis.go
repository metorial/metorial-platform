package queue

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/go-redis/redis/v8"
)

func createRedis(uri string) (*redis.Client, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	parsed, err := parseRedisURI(uri)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URI: %w", err)
	}

	client := redis.NewClient(parsed)

	err = client.Ping(ctx).Err()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return client, nil
}

func parseRedisURI(uri string) (*redis.Options, error) {
	parsedURL, err := url.Parse(uri)
	if err != nil {
		panic(fmt.Sprintf("invalid Redis URI: %s", uri))
	}

	options := &redis.Options{
		Addr: parsedURL.Host,
	}

	if parsedURL.User != nil {
		options.Password, _ = parsedURL.User.Password()
	}

	db := parsedURL.Query().Get("db")
	if db != "" {
		options.DB = 0 // Default to DB 0
	}

	return options, nil
}

func (q *Queue[_]) pendingKey() string {
	return fmt.Sprintf("queue:%s:pending", q.name)
}

func (q *Queue[_]) processingKey() string {
	return fmt.Sprintf("queue:%s:processing", q.name)
}

func (q *Queue[_]) failedKey() string {
	return fmt.Sprintf("queue:%s:failed", q.name)
}
