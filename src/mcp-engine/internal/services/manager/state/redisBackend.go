package state

import (
	"context"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

type RedisBackend struct {
	client *redis.Client
}

type RedisLockHandle struct {
	client  *redis.Client
	key     string
	value   string
	timeout time.Duration
}

func NewRedisBackend(config Config) (*RedisBackend, error) {
	if len(config.Endpoints) == 0 {
		return nil, fmt.Errorf("no redis endpoints provided")
	}

	client := redis.NewClient(&redis.Options{
		Addr:     config.Endpoints[0],
		Password: config.Password,
		DB:       config.DB,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), config.Timeout)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %v", err)
	}

	return &RedisBackend{client: client}, nil
}

func (r *RedisBackend) Put(ctx context.Context, key, value string) error {
	return r.client.Set(ctx, key, value, 0).Err()
}

func (r *RedisBackend) Get(ctx context.Context, key string) (string, error) {
	result := r.client.Get(ctx, key)
	if result.Err() == redis.Nil {
		return "", fmt.Errorf("key not found")
	}
	return result.Result()
}

func (r *RedisBackend) Delete(ctx context.Context, key string) error {
	return r.client.Del(ctx, key).Err()
}

func (r *RedisBackend) List(ctx context.Context, prefix string) (map[string]string, error) {
	pattern := prefix + "*"
	keys, err := r.client.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, err
	}

	result := make(map[string]string)
	if len(keys) == 0 {
		return result, nil
	}

	values, err := r.client.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, err
	}

	for i, key := range keys {
		if values[i] != nil {
			result[key] = values[i].(string)
		}
	}

	return result, nil
}

func (r *RedisBackend) Lock(ctx context.Context, key string) (LockHandle, error) {
	lockKey := fmt.Sprintf("lock:%s", key)
	lockValue := fmt.Sprintf("%d", time.Now().UnixNano())
	timeout := 30 * time.Second

	// Try to acquire lock with SET NX EX
	result := r.client.SetNX(ctx, lockKey, lockValue, timeout)
	if result.Err() != nil {
		return nil, fmt.Errorf("failed to acquire lock: %v", result.Err())
	}

	if !result.Val() {
		return nil, fmt.Errorf("lock already held")
	}

	return &RedisLockHandle{
		client:  r.client,
		key:     lockKey,
		value:   lockValue,
		timeout: timeout,
	}, nil
}

func (r *RedisBackend) Close() error {
	return r.client.Close()
}

func (h *RedisLockHandle) Unlock(ctx context.Context) error {
	// Use Lua script to ensure we only delete if we own the lock
	script := `
		if redis.call("GET", KEYS[1]) == ARGV[1] then
			return redis.call("DEL", KEYS[1])
		else
			return 0
		end
	`

	result := h.client.Eval(ctx, script, []string{h.key}, h.value)
	if result.Err() != nil {
		return fmt.Errorf("failed to release lock: %v", result.Err())
	}

	return nil
}
