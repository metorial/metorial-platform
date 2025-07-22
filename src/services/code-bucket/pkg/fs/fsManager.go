package fs

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/go-redis/redis/v8"
	"github.com/metorial/metorial/modules/util"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	redisFlushDelay = 5 * time.Minute
	zipExpiration   = 5 * 24 * time.Hour
	s3ZipExpiration = 365 * 24 * time.Hour
)

type FileInfo struct {
	Path        string    `json:"path"`
	Size        int64     `json:"size"`
	ContentType string    `json:"content_type"`
	ModifiedAt  time.Time `json:"modified_at"`
}

type FileData struct {
	Content     []byte    `json:"content"`
	ContentType string    `json:"content_type"`
	ModifiedAt  time.Time `json:"modified_at"`
}

type FileSystemManager struct {
	redis       *redis.Client
	s3Client    *s3.S3
	bucketName  string
	flushTicker *time.Ticker
}

func NewFileSystemManager(opts ...FileSystemManagerOption) *FileSystemManager {
	options := &FileSystemManagerOptions{}
	for _, opt := range opts {
		opt(options)
	}

	rdb := redis.NewClient(util.Must(redis.ParseURL(options.RedisURL)))

	// Initialize S3
	awsConfig := aws.NewConfig().
		WithRegion(options.AwsRegion).
		WithCredentials(credentials.NewStaticCredentials(
			options.AwsAccessKey,
			options.AwsSecretKey,
			"",
		)).
		WithEndpoint(options.AwsEndpoint).
		WithS3ForcePathStyle(true)
	sess, err := session.NewSession(awsConfig)
	if err != nil {
		panic(fmt.Sprintf("failed to create AWS session: %v", err))
	}
	s3Client := s3.New(sess)

	fsm := &FileSystemManager{
		redis:       rdb,
		s3Client:    s3Client,
		bucketName:  options.S3Bucket,
		flushTicker: time.NewTicker(30 * time.Second),
	}

	// Start background flush routine
	go fsm.backgroundFlush()
	go fsm.cleanupZipFiles()

	return fsm
}

func (fsm *FileSystemManager) GetBucketFile(ctx context.Context, bucketID, filePath string) ([]byte, string, error) {
	// First check Redis
	redisKey := fmt.Sprintf("bucket:%s:file:%s", bucketID, filePath)

	result, err := fsm.redis.Get(ctx, redisKey).Result()
	if err == nil {
		var fileData FileData
		if err := json.Unmarshal([]byte(result), &fileData); err == nil {
			return fileData.Content, fileData.ContentType, nil
		}
	}

	// Check S3
	s3Key := fmt.Sprintf("%s/%s", bucketID, filePath)
	obj, err := fsm.s3Client.GetObjectWithContext(ctx, &s3.GetObjectInput{
		Bucket: aws.String(fsm.bucketName),
		Key:    aws.String(s3Key),
	})
	if err != nil {
		return nil, "", fmt.Errorf("file not found")
	}
	defer obj.Body.Close()

	content, err := io.ReadAll(obj.Body)
	if err != nil {
		return nil, "", err
	}

	contentType := "application/octet-stream"
	if obj.ContentType != nil {
		contentType = *obj.ContentType
	}

	// Cache in Redis
	fileData := FileData{
		Content:     content,
		ContentType: contentType,
		ModifiedAt:  time.Now(),
	}
	if data, err := json.Marshal(fileData); err == nil {
		fsm.redis.Set(ctx, redisKey, data, redisFlushDelay*2)
	}

	return content, contentType, nil
}

func (fsm *FileSystemManager) PutBucketFile(ctx context.Context, bucketID, filePath string, content []byte, contentType string) error {
	// Store in Redis first
	redisKey := fmt.Sprintf("bucket:%s:file:%s", bucketID, filePath)
	fileData := FileData{
		Content:     content,
		ContentType: contentType,
		ModifiedAt:  time.Now(),
	}

	data, err := json.Marshal(fileData)
	if err != nil {
		return err
	}

	err = fsm.redis.Set(ctx, redisKey, data, redisFlushDelay*2).Err()
	if err != nil {
		return err
	}

	// Mark for flush
	flushKey := fmt.Sprintf("flush:%s:%s", bucketID, filePath)
	fsm.redis.Set(ctx, flushKey, time.Now().Unix(), redisFlushDelay*2)

	return nil
}

func (fsm *FileSystemManager) DeleteBucketFile(ctx context.Context, bucketID, filePath string) error {
	// Check if file exists first
	redisKey := fmt.Sprintf("bucket:%s:file:%s", bucketID, filePath)
	exists := fsm.redis.Exists(ctx, redisKey).Val()

	if exists == 0 {
		// Check S3
		s3Key := fmt.Sprintf("%s/%s", bucketID, filePath)
		_, err := fsm.s3Client.HeadObjectWithContext(ctx, &s3.HeadObjectInput{
			Bucket: aws.String(fsm.bucketName),
			Key:    aws.String(s3Key),
		})
		if err != nil {
			return fmt.Errorf("file not found")
		}
	}

	// Delete from Redis
	fsm.redis.Del(ctx, redisKey)

	// Delete from S3
	s3Key := fmt.Sprintf("%s/%s", bucketID, filePath)
	_, err := fsm.s3Client.DeleteObjectWithContext(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(fsm.bucketName),
		Key:    aws.String(s3Key),
	})

	return err
}

func (fsm *FileSystemManager) GetBucketFiles(ctx context.Context, bucketID, prefix string) ([]FileInfo, error) {
	var files []FileInfo

	// Get files from Redis
	pattern := fmt.Sprintf("bucket:%s:file:*", bucketID)
	keys, err := fsm.redis.Keys(ctx, pattern).Result()
	if err == nil {
		for _, key := range keys {
			filePath := strings.TrimPrefix(key, fmt.Sprintf("bucket:%s:file:", bucketID))
			if prefix != "" && !strings.HasPrefix(filePath, prefix) {
				continue
			}

			result, err := fsm.redis.Get(ctx, key).Result()
			if err != nil {
				continue
			}

			var fileData FileData
			if err := json.Unmarshal([]byte(result), &fileData); err != nil {
				continue
			}

			files = append(files, FileInfo{
				Path:        filePath,
				Size:        int64(len(fileData.Content)),
				ContentType: fileData.ContentType,
				ModifiedAt:  fileData.ModifiedAt,
			})
		}
	}

	// Get files from S3
	s3Prefix := bucketID + "/"
	if prefix != "" {
		s3Prefix += prefix
	}

	result, err := fsm.s3Client.ListObjectsV2WithContext(ctx, &s3.ListObjectsV2Input{
		Bucket: aws.String(fsm.bucketName),
		Prefix: aws.String(s3Prefix),
	})
	if err == nil {
		for _, obj := range result.Contents {
			filePath := strings.TrimPrefix(*obj.Key, bucketID+"/")

			// Skip if already in Redis results
			found := false
			for _, f := range files {
				if f.Path == filePath {
					found = true
					break
				}
			}
			if found {
				continue
			}

			contentType := "application/octet-stream"
			if obj.StorageClass != nil {
				// Get content type from object metadata
				headObj, err := fsm.s3Client.HeadObjectWithContext(ctx, &s3.HeadObjectInput{
					Bucket: aws.String(fsm.bucketName),
					Key:    obj.Key,
				})
				if err == nil && headObj.ContentType != nil {
					contentType = *headObj.ContentType
				}
			}

			files = append(files, FileInfo{
				Path:        filePath,
				Size:        *obj.Size,
				ContentType: contentType,
				ModifiedAt:  *obj.LastModified,
			})
		}
	}

	return files, nil
}

func (fsm *FileSystemManager) GetBucketFilesAsZip(ctx context.Context, bucketId, prefix string) (*string, *time.Time, error) {
	files, err := fsm.GetBucketFiles(ctx, bucketId, prefix)
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to get files: %v", err)
	}

	// Create zip file
	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	for _, file := range files {
		content, _, err := fsm.GetBucketFile(ctx, bucketId, file.Path)
		if err != nil {
			continue
		}

		f, err := zipWriter.Create(file.Path)
		if err != nil {
			continue
		}

		f.Write(content)
	}

	zipWriter.Close()

	// Upload zip to S3
	hash := sha256.Sum256(buf.Bytes())
	zipKey := fmt.Sprintf("zips/%x.zip", hash)

	_, err = fsm.s3Client.PutObjectWithContext(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(fsm.bucketName),
		Key:         aws.String(zipKey),
		Body:        bytes.NewReader(buf.Bytes()),
		ContentType: aws.String("application/zip"),
	})
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to upload zip: %v", err)
	}

	// Create presigned URL
	req2, _ := fsm.s3Client.GetObjectRequest(&s3.GetObjectInput{
		Bucket: aws.String(fsm.bucketName),
		Key:    aws.String(zipKey),
	})

	url, err := req2.Presign(s3ZipExpiration)
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to create presigned URL: %v", err)
	}

	// Track zip file for cleanup
	redisKey := fmt.Sprintf("zip:%s", zipKey)
	fsm.redis.Set(ctx, redisKey, time.Now().Unix(), zipExpiration*2)

	expiresAt := time.Now().Add(s3ZipExpiration)

	return &url, &expiresAt, nil
}
