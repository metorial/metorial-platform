package fs

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/go-redis/redis/v8"
	memoryQueue "github.com/metorial/metorial/modules/memory-queue"
	"github.com/metorial/metorial/modules/util"
	zipImporter "github.com/metorial/metorial/services/code-bucket/pkg/zip-importer"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	redisFlushDelay   = 5 * time.Minute
	zipExpiration     = 3 * 24 * time.Hour
	s3ZipExpiration   = 5 * 24 * time.Hour
	maxRedisCacheSize = 1 * 1024 * 1024
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
	redis           *redis.Client
	s3Client        *s3.S3
	bucketName      string
	flushTicker     *time.Ticker
	importSemaphore chan struct{}
}

type FileContentsBase struct {
	Path    string `json:"path"`
	Content []byte `json:"content"`
}

func NewFileSystemManager(opts ...FileSystemManagerOption) *FileSystemManager {
	options := &FileSystemManagerOptions{}
	for _, opt := range opts {
		opt(options)
	}

	rdb := redis.NewClient(
		util.Must(redis.ParseURL(options.RedisURL)),
	)

	var sess *session.Session
	var err error

	if options.AwsEndpoint != "" {
		awsConfig := &aws.Config{
			Region:           aws.String(options.AwsRegion),
			Endpoint:         aws.String(options.AwsEndpoint),
			S3ForcePathStyle: aws.Bool(true),
		}

		if options.AwsAccessKey != "" && options.AwsSecretKey != "" {
			awsConfig.Credentials = credentials.NewStaticCredentials(
				options.AwsAccessKey,
				options.AwsSecretKey,
				"",
			)
		}

		sess, err = session.NewSession(awsConfig)
	} else {
		awsConfig := &aws.Config{
			Region: aws.String(options.AwsRegion),
		}

		if options.AwsAccessKey != "" && options.AwsSecretKey != "" {
			awsConfig.Credentials = credentials.NewStaticCredentials(
				options.AwsAccessKey,
				options.AwsSecretKey,
				"",
			)
		}

		sess, err = session.NewSession(awsConfig)
	}

	if err != nil {
		panic(fmt.Sprintf("failed to create AWS session: %v", err))
	}

	s3Client := s3.New(sess)

	fsm := &FileSystemManager{
		redis:           rdb,
		s3Client:        s3Client,
		bucketName:      options.S3Bucket,
		flushTicker:     time.NewTicker(60 * time.Second),
		importSemaphore: make(chan struct{}, 15),
	}

	go fsm.backgroundFlush()
	go fsm.cleanupZipFiles()

	return fsm
}

func (fsm *FileSystemManager) GetBucketFile(ctx context.Context, bucketID, filePath string) (*FileInfo, *FileData, error) {
	redisKey := fmt.Sprintf("bucket:%s:file:%s", bucketID, filePath)

	result, err := fsm.redis.Get(ctx, redisKey).Result()
	if err == nil {
		var fileData FileData
		if err := json.Unmarshal([]byte(result), &fileData); err == nil {

			info := &FileInfo{
				Path:        filePath,
				Size:        int64(len(fileData.Content)),
				ContentType: fileData.ContentType,
				ModifiedAt:  fileData.ModifiedAt,
			}

			return info, &fileData, nil
		}
	}

	s3Key := fmt.Sprintf("%s/%s", bucketID, filePath)
	obj, err := fsm.s3Client.GetObjectWithContext(ctx, &s3.GetObjectInput{
		Bucket: aws.String(fsm.bucketName),
		Key:    aws.String(s3Key),
	})
	if err != nil {
		return nil, nil, fmt.Errorf("file not found")
	}
	defer obj.Body.Close()

	content, err := io.ReadAll(obj.Body)
	if err != nil {
		return nil, nil, err
	}

	contentType := "application/octet-stream"
	if obj.ContentType != nil {
		contentType = *obj.ContentType
	}

	modifiedAt := time.Now()
	if obj.LastModified != nil {
		modifiedAt = *obj.LastModified
	}

	fileData := FileData{
		Content:     content,
		ContentType: contentType,
		ModifiedAt:  modifiedAt,
	}

	if len(content) <= maxRedisCacheSize {
		if data, err := json.Marshal(fileData); err == nil {
			fsm.redis.Set(ctx, redisKey, data, redisFlushDelay*2)
		}
	}

	info := &FileInfo{
		Path:        filePath,
		Size:        int64(len(content)),
		ContentType: contentType,
		ModifiedAt:  modifiedAt,
	}

	return info, &fileData, nil
}

func (fsm *FileSystemManager) PutBucketFile(ctx context.Context, bucketID, filePath string, content []byte, contentType string) error {

	if len(content) > maxRedisCacheSize {
		s3Key := fmt.Sprintf("%s/%s", bucketID, filePath)
		_, err := fsm.s3Client.PutObjectWithContext(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(fsm.bucketName),
			Key:         aws.String(s3Key),
			Body:        bytes.NewReader(content),
			ContentType: aws.String(contentType),
		})
		return err
	}

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

	flushKey := fmt.Sprintf("flush:%s:%s", bucketID, filePath)
	fsm.redis.Set(ctx, flushKey, time.Now().Unix(), redisFlushDelay*2)

	return nil
}

func (fsm *FileSystemManager) DeleteBucketFile(ctx context.Context, bucketID, filePath string) error {
	redisKey := fmt.Sprintf("bucket:%s:file:%s", bucketID, filePath)
	exists := fsm.redis.Exists(ctx, redisKey).Val()

	if exists != 0 {
		fsm.redis.Del(ctx, redisKey)
	}

	s3Key := fmt.Sprintf("%s/%s", bucketID, filePath)
	_, err := fsm.s3Client.DeleteObjectWithContext(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(fsm.bucketName),
		Key:    aws.String(s3Key),
	})

	return err
}

func (fsm *FileSystemManager) GetBucketFiles(ctx context.Context, bucketID, prefix string) ([]FileInfo, error) {
	files := make([]FileInfo, 0)

	pattern := fmt.Sprintf("bucket:%s:file:*", bucketID)
	var keys []string
	iter := fsm.redis.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}
	if iter.Err() == nil {
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

	tmpFile, err := os.CreateTemp("", "bucket-zip-*.zip")
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	hash := sha256.New()
	multiWriter := io.MultiWriter(tmpFile, hash)

	zipWriter := zip.NewWriter(multiWriter)

	for _, file := range files {
		_, data, err := fsm.GetBucketFile(ctx, bucketId, file.Path)
		if err != nil {
			continue
		}

		f, err := zipWriter.Create(file.Path)
		if err != nil {
			continue
		}

		f.Write(data.Content)
	}

	zipWriter.Close()

	zipKey := fmt.Sprintf("zips/%x.zip", hash.Sum(nil))

	tmpFile.Seek(0, 0)

	_, err = fsm.s3Client.PutObjectWithContext(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(fsm.bucketName),
		Key:         aws.String(zipKey),
		Body:        tmpFile,
		ContentType: aws.String("application/zip"),
	})
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to upload zip: %v", err)
	}

	req2, _ := fsm.s3Client.GetObjectRequest(&s3.GetObjectInput{
		Bucket: aws.String(fsm.bucketName),
		Key:    aws.String(zipKey),
	})

	url, err := req2.Presign(s3ZipExpiration)
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to create presigned URL: %v", err)
	}

	redisKey := fmt.Sprintf("zip:%s", zipKey)
	fsm.redis.Set(ctx, redisKey, time.Now().Unix(), zipExpiration*2)

	expiresAt := time.Now().Add(s3ZipExpiration)

	return &url, &expiresAt, nil
}

func (fsm *FileSystemManager) Clone(ctx context.Context, sourceBucketId, newBucketId string) error {
	select {
	case fsm.importSemaphore <- struct{}{}:
		defer func() { <-fsm.importSemaphore }()
	case <-ctx.Done():
		return ctx.Err()
	}

	files, err := fsm.GetBucketFiles(ctx, sourceBucketId, "")
	if err != nil {
		return status.Errorf(codes.NotFound, "source bucket not found: %v", err)
	}

	queue := memoryQueue.NewBlockingJobQueue(15)

	for _, file := range files {
		queue.AddAndBlockIfFull(func() error {
			info, content, err := fsm.GetBucketFile(ctx, sourceBucketId, file.Path)
			if err != nil && !strings.Contains(err.Error(), "not found") {
				return err
			}

			fsm.PutBucketFile(ctx, newBucketId, file.Path, content.Content, info.ContentType)

			return nil
		})
	}

	return queue.Wait()
}

func (fsm *FileSystemManager) ImportZip(ctx context.Context, newBucketId string, iterator *zipImporter.ZipFileIterator) error {
	select {
	case fsm.importSemaphore <- struct{}{}:
		defer func() { <-fsm.importSemaphore }()
	case <-ctx.Done():
		return ctx.Err()
	}

	queue := memoryQueue.NewBlockingJobQueue(15)

	for {
		file, ok := iterator.Next()
		if !ok {
			break
		}

		queue.AddAndBlockIfFull(func() error {
			fsm.PutBucketFile(ctx, newBucketId, file.Path, file.Content, "application/octet-stream")

			return nil
		})
	}

	return queue.Wait()
}

func (fsm *FileSystemManager) ImportContents(ctx context.Context, newBucketId string, contents []*FileContentsBase) error {
	select {
	case fsm.importSemaphore <- struct{}{}:
		defer func() { <-fsm.importSemaphore }()
	case <-ctx.Done():
		return ctx.Err()
	}

	queue := memoryQueue.NewBlockingJobQueue(15)

	for _, file := range contents {
		f := file
		queue.AddAndBlockIfFull(func() error {
			fsm.PutBucketFile(ctx, newBucketId, f.Path, f.Content, "application/octet-stream")

			return nil
		})
	}

	return queue.Wait()
}

func (fsm *FileSystemManager) Close() {
	fsm.flushPendingFiles()

	if fsm.flushTicker != nil {
		fsm.flushTicker.Stop()
	}
	fsm.redis.Close()
}
