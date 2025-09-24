package state

import (
	"context"
	"time"
)

type StorageBackend interface {
	Put(ctx context.Context, key, value string) error
	Get(ctx context.Context, key string) (string, error)
	Delete(ctx context.Context, key string) error
	List(ctx context.Context, prefix string) (map[string]string, error)

	Lock(ctx context.Context, key string) (LockHandle, error)

	Close() error
}

type LockHandle interface {
	Unlock(ctx context.Context) error
}

type BackendType string

const (
	BackendEtcd  BackendType = "etcd"
	BackendRedis BackendType = "redis"
)

type Config struct {
	BackendType BackendType

	// Common config
	Endpoints []string
	Timeout   time.Duration

	// Redis specific
	Password string
	DB       int
	Tls      bool

	// etcd specific
	DialTimeout time.Duration
}
