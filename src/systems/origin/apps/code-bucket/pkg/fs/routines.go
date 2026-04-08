package fs

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"
)

func (fsm *FileSystemManager) backgroundFlush() {
	for range fsm.flushTicker.C {
		fsm.flushPendingFiles()
	}
}

func (fsm *FileSystemManager) flushPendingFiles() {
	log.Println("Flushing pending files to storage...")

	ctx := context.Background()
	pattern := "flush:*"

	// Use SCAN instead of KEYS to avoid blocking Redis
	var keys []string
	iter := fsm.redis.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if err := iter.Err(); err != nil {
		log.Printf("Error scanning flush keys: %v", err)
		return
	}

	// Limit concurrent flushes to prevent goroutine explosion
	semaphore := make(chan struct{}, 10)
	var wg sync.WaitGroup

	for _, key := range keys {
		parts := strings.Split(key, ":")
		if len(parts) < 3 {
			continue
		}

		bucketID := parts[1]
		filePath := strings.Join(parts[2:], ":")

		// Check if enough time has passed
		timestampStr, err := fsm.redis.Get(ctx, key).Result()
		if err != nil {
			continue
		}

		timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
		if err != nil {
			continue
		}

		if time.Since(time.Unix(timestamp, 0)) < redisFlushDelay {
			continue
		}

		// Use locking to prevent multiple instances from flushing the same file
		lockKey := fmt.Sprintf("lock:%s:%s", bucketID, filePath)
		if !fsm.acquireLock(ctx, lockKey) {
			continue
		}

		wg.Add(1)
		semaphore <- struct{}{} // Acquire semaphore

		go func(bucketID, filePath, key, lockKey string) {
			defer wg.Done()
			defer func() { <-semaphore }() // Release semaphore
			defer fsm.releaseLock(ctx, lockKey)

			if err := fsm.flushFileToStorage(ctx, bucketID, filePath); err != nil {
				log.Printf("Error flushing file %s/%s to storage: %v", bucketID, filePath, err)
			} else {
				fsm.redis.Del(ctx, key)
			}
		}(bucketID, filePath, key, lockKey)
	}

	wg.Wait()
}

func (fsm *FileSystemManager) acquireLock(ctx context.Context, lockKey string) bool {
	result := fsm.redis.SetNX(ctx, lockKey, "locked", 5*time.Minute)
	return result.Val()
}

func (fsm *FileSystemManager) releaseLock(ctx context.Context, lockKey string) {
	fsm.redis.Del(ctx, lockKey)
}

func (fsm *FileSystemManager) flushFileToStorage(ctx context.Context, bucketID, filePath string) error {
	redisKey := fmt.Sprintf("bucket:%s:file:%s", bucketID, filePath)

	result, err := fsm.redis.Get(ctx, redisKey).Result()
	if err != nil {
		return err
	}

	var fileData FileData
	if err := json.Unmarshal([]byte(result), &fileData); err != nil {
		return err
	}

	objectKey := fmt.Sprintf("%s/%s", bucketID, filePath)
	_, err = fsm.objectStorage.PutObject(fsm.bucketName, objectKey, fileData.Content, &fileData.ContentType, nil)

	return err
}

func (fsm *FileSystemManager) cleanupZipFiles() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		ctx := context.Background()
		pattern := "zip:*"

		// Use SCAN instead of KEYS to avoid blocking Redis
		var keys []string
		iter := fsm.redis.Scan(ctx, 0, pattern, 100).Iterator()
		for iter.Next(ctx) {
			keys = append(keys, iter.Val())
		}
		if iter.Err() != nil {
			continue
		}

		for _, key := range keys {
			timestampStr, err := fsm.redis.Get(ctx, key).Result()
			if err != nil {
				continue
			}

			timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
			if err != nil {
				continue
			}

			if time.Since(time.Unix(timestamp, 0)) > zipExpiration {
				// Extract object key from Redis key and delete from object storage
				objectKey := strings.TrimPrefix(key, "zip:")
				fsm.objectStorage.DeleteObject(fsm.bucketName, objectKey)

				fsm.redis.Del(ctx, key)
			}
		}
	}
}
