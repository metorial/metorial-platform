package fs

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/s3"
)

func (fsm *FileSystemManager) backgroundFlush() {
	for range fsm.flushTicker.C {
		fsm.flushPendingFiles()
	}
}

func (fsm *FileSystemManager) flushPendingFiles() {
	ctx := context.Background()
	pattern := "flush:*"

	keys, err := fsm.redis.Keys(ctx, pattern).Result()
	if err != nil {
		log.Printf("Error getting flush keys: %v", err)
		return
	}

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

		go func(bucketID, filePath, key, lockKey string) {
			defer fsm.releaseLock(ctx, lockKey)

			if err := fsm.flushFileToS3(ctx, bucketID, filePath); err != nil {
				log.Printf("Error flushing file %s/%s to S3: %v", bucketID, filePath, err)
			} else {
				fsm.redis.Del(ctx, key)
			}
		}(bucketID, filePath, key, lockKey)
	}
}

func (fsm *FileSystemManager) acquireLock(ctx context.Context, lockKey string) bool {
	result := fsm.redis.SetNX(ctx, lockKey, "locked", 5*time.Minute)
	return result.Val()
}

func (fsm *FileSystemManager) releaseLock(ctx context.Context, lockKey string) {
	fsm.redis.Del(ctx, lockKey)
}

func (fsm *FileSystemManager) flushFileToS3(ctx context.Context, bucketID, filePath string) error {
	redisKey := fmt.Sprintf("bucket:%s:file:%s", bucketID, filePath)

	result, err := fsm.redis.Get(ctx, redisKey).Result()
	if err != nil {
		return err
	}

	var fileData FileData
	if err := json.Unmarshal([]byte(result), &fileData); err != nil {
		return err
	}

	s3Key := fmt.Sprintf("%s/%s", bucketID, filePath)
	_, err = fsm.s3Client.PutObjectWithContext(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(fsm.bucketName),
		Key:         aws.String(s3Key),
		Body:        bytes.NewReader(fileData.Content),
		ContentType: aws.String(fileData.ContentType),
	})

	return err
}

func (fsm *FileSystemManager) cleanupZipFiles() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		ctx := context.Background()
		pattern := "zip:*"

		keys, err := fsm.redis.Keys(ctx, pattern).Result()
		if err != nil {
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
				// Extract S3 key from Redis key and delete from S3
				s3Key := strings.TrimPrefix(key, "zip:")
				fsm.s3Client.DeleteObject(&s3.DeleteObjectInput{
					Bucket: aws.String(fsm.bucketName),
					Key:    aws.String(s3Key),
				})

				fsm.redis.Del(ctx, key)
			}
		}
	}
}
