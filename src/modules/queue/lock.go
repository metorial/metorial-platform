package queue

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

type lockManager struct {
	client        *redis.Client
	processingKey string
	lockValue     string
	ctx           context.Context
	cancel        context.CancelFunc
	wg            sync.WaitGroup
	lockDuration  time.Duration
}

func newLockManager(client *redis.Client, processingKey, lockValue string, lockDuration time.Duration) *lockManager {
	ctx, cancel := context.WithCancel(context.Background())
	return &lockManager{
		client:        client,
		processingKey: processingKey,
		lockValue:     lockValue,
		ctx:           ctx,
		cancel:        cancel,
		lockDuration:  lockDuration,
	}
}

func (le *lockManager) start() {
	le.wg.Add(1)
	go func() {
		defer le.wg.Done()

		ticker := time.NewTicker(le.lockDuration / 2)
		defer ticker.Stop()

		for {
			select {
			case <-le.ctx.Done():
				return
			case <-ticker.C:
				le.extend()
			}
		}
	}()
}

func (le *lockManager) extend() {
	// Lua script to extend lock if it still exists and belongs to us
	luaScript := `
		local processing_key = KEYS[1]
		local lock_value = ARGV[1]
		local new_expiry = tonumber(ARGV[2])
		
		-- Check if our lock still exists
		local current_score = redis.call('ZSCORE', processing_key, lock_value)
		if current_score then
			-- Extend the lock by updating the score
			redis.call('ZADD', processing_key, new_expiry, lock_value)
			return 1
		end
		return 0
	`

	newExpiry := time.Now().Add(le.lockDuration).Unix()
	result, err := le.client.Eval(le.ctx, luaScript, []string{le.processingKey}, le.lockValue, newExpiry).Result()

	if err != nil {
		log.Printf("Failed to extend lock: %v", err)
		return
	}

	if result.(int64) == 1 {
		log.Printf("Extended lock for job until %v", time.Unix(newExpiry, 0))
	} else {
		log.Printf("Lock no longer exists, stopping extension")
		le.cancel()
	}
}

func (le *lockManager) stop() {
	le.cancel()
	le.wg.Wait()
}
