package fs

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	memoryQueue "github.com/metorial/metorial/services/code-bucket/pkg/memory-queue"
	"github.com/metorial/metorial/services/code-bucket/pkg/util"
	zipImporter "github.com/metorial/metorial/services/code-bucket/pkg/zip-importer"
	objectstorage "github.com/metorial/object-storage/clients/go"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	redisFlushDelay   = 5 * time.Minute
	zipExpiration     = 3 * 24 * time.Hour
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
	objectStorage   *objectstorage.Client
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

	objectStorageClient := objectstorage.NewClient(options.ObjectStorageEndpoint)

	fsm := &FileSystemManager{
		redis:           rdb,
		objectStorage:   objectStorageClient,
		bucketName:      options.ObjectStorageBucket,
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

	objectKey := fmt.Sprintf("%s/%s", bucketID, filePath)
	obj, err := fsm.objectStorage.GetObject(fsm.bucketName, objectKey)
	if err != nil {
		return nil, nil, fmt.Errorf("file not found")
	}

	content := obj.Data

	contentType := "application/octet-stream"
	if obj.Metadata.ContentType != nil {
		contentType = *obj.Metadata.ContentType
	}

	modifiedAt := time.Now()
	if obj.Metadata.LastModified != "" {
		parsedTime, err := time.Parse(time.RFC3339, obj.Metadata.LastModified)
		if err == nil {
			modifiedAt = parsedTime
		}
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
		objectKey := fmt.Sprintf("%s/%s", bucketID, filePath)
		_, err := fsm.objectStorage.PutObject(fsm.bucketName, objectKey, content, &contentType, nil)
		return err
	}

	if !strings.HasPrefix(filePath, "/") {
		filePath = "/" + filePath
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

	objectKey := fmt.Sprintf("%s/%s", bucketID, filePath)
	err := fsm.objectStorage.DeleteObject(fsm.bucketName, objectKey)

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

	objectPrefix := bucketID + "/"
	if prefix != "" {
		objectPrefix += prefix
	}

	var prefixPtr *string
	if objectPrefix != "" {
		prefixPtr = &objectPrefix
	}

	objects, err := fsm.objectStorage.ListObjects(fsm.bucketName, prefixPtr, nil)
	if err == nil {
		for _, obj := range objects {
			filePath := strings.TrimPrefix(obj.Key, bucketID+"/")

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
			if obj.ContentType != nil {
				contentType = *obj.ContentType
			}

			modifiedAt := time.Now()
			if obj.LastModified != "" {
				parsedTime, err := time.Parse(time.RFC3339, obj.LastModified)
				if err == nil {
					modifiedAt = parsedTime
				}
			}

			files = append(files, FileInfo{
				Path:        filePath,
				Size:        int64(obj.Size),
				ContentType: contentType,
				ModifiedAt:  modifiedAt,
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

	zipContent, err := io.ReadAll(tmpFile)
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to read zip file: %v", err)
	}

	contentType := "application/zip"
	_, err = fsm.objectStorage.PutObject(fsm.bucketName, zipKey, zipContent, &contentType, nil)
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to upload zip: %v", err)
	}

	url := fmt.Sprintf("/download/%s/%s", fsm.bucketName, zipKey)

	redisKey := fmt.Sprintf("zip:%s", zipKey)
	fsm.redis.Set(ctx, redisKey, time.Now().Unix(), zipExpiration*2)

	expiresAt := time.Now().Add(zipExpiration)

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

func (fsm *FileSystemManager) SetBucketFiles(ctx context.Context, bucketId string, contents []*FileContentsBase) error {
	queue := memoryQueue.NewBlockingJobQueue(15)

	for _, file := range contents {
		f := file
		queue.AddAndBlockIfFull(func() error {
			return fsm.PutBucketFile(ctx, bucketId, f.Path, f.Content, "application/octet-stream")
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
