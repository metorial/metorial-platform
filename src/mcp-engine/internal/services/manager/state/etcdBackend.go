package state

import (
	"context"
	"fmt"
	"time"

	clientv3 "go.etcd.io/etcd/client/v3"
	"go.etcd.io/etcd/client/v3/concurrency"
)

type EtcdBackend struct {
	client *clientv3.Client
}

type EtcdLockHandle struct {
	mutex   *concurrency.Mutex
	session *concurrency.Session
}

func NewEtcdBackend(config Config) (*EtcdBackend, error) {
	dialTimeout := config.DialTimeout
	if dialTimeout == 0 {
		dialTimeout = 5 * time.Second
	}

	client, err := clientv3.New(clientv3.Config{
		Endpoints:   config.Endpoints,
		DialTimeout: dialTimeout,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create etcd client: %v", err)
	}

	return &EtcdBackend{client: client}, nil
}

func (e *EtcdBackend) Put(ctx context.Context, key, value string) error {
	_, err := e.client.Put(ctx, key, value)
	return err
}

func (e *EtcdBackend) Get(ctx context.Context, key string) (string, error) {
	resp, err := e.client.Get(ctx, key)
	if err != nil {
		return "", err
	}

	if len(resp.Kvs) == 0 {
		return "", fmt.Errorf("key not found")
	}

	return string(resp.Kvs[0].Value), nil
}

func (e *EtcdBackend) Delete(ctx context.Context, key string) error {
	_, err := e.client.Delete(ctx, key)
	return err
}

func (e *EtcdBackend) List(ctx context.Context, prefix string) (map[string]string, error) {
	resp, err := e.client.Get(ctx, prefix, clientv3.WithPrefix())
	if err != nil {
		return nil, err
	}

	result := make(map[string]string)
	for _, kv := range resp.Kvs {
		result[string(kv.Key)] = string(kv.Value)
	}

	return result, nil
}

func (e *EtcdBackend) Lock(ctx context.Context, key string) (LockHandle, error) {
	lockKey := fmt.Sprintf("/locks%s", key)

	lockSession, err := concurrency.NewSession(e.client)
	if err != nil {
		return nil, fmt.Errorf("failed to create etcd session for locking: %v", err)
	}

	mutex := concurrency.NewMutex(lockSession, lockKey)

	if err := mutex.Lock(ctx); err != nil {
		lockSession.Close()
		return nil, fmt.Errorf("failed to acquire lock: %v", err)
	}

	return &EtcdLockHandle{
		mutex:   mutex,
		session: lockSession,
	}, nil
}

func (e *EtcdBackend) Close() error {
	return e.client.Close()
}

func (h *EtcdLockHandle) Unlock(ctx context.Context) error {
	defer h.session.Close()

	if err := h.mutex.Unlock(ctx); err != nil {
		return fmt.Errorf("failed to release lock: %v", err)
	}

	return nil
}
