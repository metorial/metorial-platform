package fs

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
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
	redisFlushDelay    = 5 * time.Minute
	zipExpiration      = 3 * 24 * time.Hour
	maxRedisCacheSize  = 1 * 1024 * 1024
	maxFileBatchSize   = 8 * 1024 * 1024
	zipStreamChunkSize = 64 * 1024
)

func canonicalFilePath(filePath string) string {
	if filePath == "" {
		return "/"
	}
	if !strings.HasPrefix(filePath, "/") {
		return "/" + filePath
	}
	return filePath
}

func redisFileKey(bucketID, filePath string) string {
	return fmt.Sprintf("bucket:%s:file:%s", bucketID, canonicalFilePath(filePath))
}

func redisFlushKey(bucketID, filePath string) string {
	return fmt.Sprintf("flush:%s:%s", bucketID, canonicalFilePath(filePath))
}

func objectStorageKey(bucketID, filePath string) string {
	return bucketID + "/" + strings.TrimPrefix(filePath, "/")
}

func shouldBufferInRedis(size int) bool {
	return size < maxRedisCacheSize
}

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
	redis            *redis.Client
	objectStorage    *objectstorage.Client
	objectStorageURL string
	httpClient       *http.Client
	bucketName       string
	flushTicker      *time.Ticker
	importSemaphore  chan struct{}
}

type FileContentsBase struct {
	Path    string `json:"path"`
	Content []byte `json:"content"`
}

type FileContentItem struct {
	Info    FileInfo
	Content []byte
}

type contentBatchAccumulator struct {
	maxBytes   int64
	batch      []FileContentItem
	batchBytes int64
	flush      func([]FileContentItem) error
}

type ZipChunkSender func([]byte) error

type zipStreamWriter struct {
	ctx  context.Context
	send ZipChunkSender
}

func (w *zipStreamWriter) Write(p []byte) (int, error) {
	total := len(p)
	written := 0

	for len(p) > 0 {
		select {
		case <-w.ctx.Done():
			return written, w.ctx.Err()
		default:
		}

		chunkSize := zipStreamChunkSize
		if len(p) < chunkSize {
			chunkSize = len(p)
		}

		chunk := make([]byte, chunkSize)
		copy(chunk, p[:chunkSize])

		if err := w.send(chunk); err != nil {
			return written, err
		}

		written += chunkSize
		p = p[chunkSize:]
	}

	return total, nil
}

func NewFileSystemManager(opts ...FileSystemManagerOption) *FileSystemManager {
	options := &FileSystemManagerOptions{}
	for _, opt := range opts {
		opt(options)
	}

	rdb := redis.NewClient(
		util.Must(redis.ParseURL(options.RedisURL)),
	)

	httpClient := newDebugObjectStorageHTTPClient(30 * time.Minute)
	objectStorageClient := objectstorage.NewClientWithHTTP(options.ObjectStorageEndpoint, httpClient)
	log.Printf("[object-storage debug] client ready endpoint=%s bucket=%s timeout=%s", options.ObjectStorageEndpoint, options.ObjectStorageBucket, 30*time.Minute)

	fsm := &FileSystemManager{
		redis:            rdb,
		objectStorage:    objectStorageClient,
		objectStorageURL: options.ObjectStorageEndpoint,
		httpClient:       httpClient,
		bucketName:       options.ObjectStorageBucket,
		flushTicker:      time.NewTicker(60 * time.Second),
		importSemaphore:  make(chan struct{}, 15),
	}

	go fsm.backgroundFlush()
	go fsm.cleanupZipFiles()

	return fsm
}

func newDebugObjectStorageHTTPClient(timeout time.Duration) *http.Client {
	dialer := &net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			started := time.Now()
			log.Printf("[object-storage debug] dial start network=%s addr=%s", network, addr)
			conn, err := dialer.DialContext(ctx, network, addr)
			if err != nil {
				log.Printf("[object-storage debug] dial failed network=%s addr=%s duration=%s err=%v", network, addr, time.Since(started), err)
				return nil, err
			}
			log.Printf("[object-storage debug] dial ok network=%s addr=%s local=%s remote=%s duration=%s", network, addr, conn.LocalAddr(), conn.RemoteAddr(), time.Since(started))
			return conn, nil
		},
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return &http.Client{
		Timeout:   timeout,
		Transport: &debugRoundTripper{base: transport},
	}
}

type debugRoundTripper struct {
	base http.RoundTripper
}

func (t *debugRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	started := time.Now()
	log.Printf("[object-storage debug] http start method=%s url=%s content_length=%d host=%s", req.Method, req.URL.String(), req.ContentLength, req.URL.Host)
	resp, err := t.base.RoundTrip(req)
	if err != nil {
		log.Printf("[object-storage debug] http failed method=%s url=%s content_length=%d duration=%s err=%v", req.Method, req.URL.String(), req.ContentLength, time.Since(started), err)
		return nil, err
	}
	log.Printf("[object-storage debug] http done method=%s url=%s content_length=%d status=%d duration=%s", req.Method, req.URL.String(), req.ContentLength, resp.StatusCode, time.Since(started))
	return resp, nil
}

func normalizeSeenPath(filePath string) string {
	return strings.TrimPrefix(filePath, "/")
}

func pathMatchesPrefix(filePath, prefix string) bool {
	if prefix == "" {
		return true
	}

	normalizedPath := normalizeSeenPath(filePath)
	normalizedPrefix := normalizeSeenPath(prefix)
	return strings.HasPrefix(normalizedPath, normalizedPrefix)
}

func (a *contentBatchAccumulator) Add(item FileContentItem) error {
	if a.maxBytes <= 0 {
		a.maxBytes = maxFileBatchSize
	}

	fileBytes := int64(len(item.Content))
	if len(a.batch) > 0 && a.batchBytes+fileBytes > a.maxBytes {
		if err := a.Flush(); err != nil {
			return err
		}
	}

	a.batch = append(a.batch, item)
	a.batchBytes += fileBytes

	if a.batchBytes >= a.maxBytes {
		return a.Flush()
	}

	return nil
}

func (a *contentBatchAccumulator) Flush() error {
	if len(a.batch) == 0 {
		return nil
	}

	if err := a.flush(a.batch); err != nil {
		return err
	}

	a.batch = nil
	a.batchBytes = 0
	return nil
}

func (fsm *FileSystemManager) WalkBucketFiles(ctx context.Context, bucketID, prefix string, fn func(FileInfo) error) error {
	seen := map[string]struct{}{}
	redisPrefix := fmt.Sprintf("bucket:%s:file:", bucketID)

	pattern := redisPrefix + "*"
	iter := fsm.redis.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		key := iter.Val()
		filePath := strings.TrimPrefix(key, redisPrefix)
		if !pathMatchesPrefix(filePath, prefix) {
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

		seen[normalizeSeenPath(filePath)] = struct{}{}
		if err := fn(FileInfo{
			Path:        filePath,
			Size:        int64(len(fileData.Content)),
			ContentType: fileData.ContentType,
			ModifiedAt:  fileData.ModifiedAt,
		}); err != nil {
			return err
		}
	}
	if err := iter.Err(); err != nil {
		return err
	}

	objectPrefix := bucketID + "/"
	if prefix != "" {
		objectPrefix += normalizeSeenPath(prefix)
	}

	objects, err := fsm.objectStorage.ListObjects(fsm.bucketName, &objectPrefix, nil)
	if err != nil {
		return nil
	}

	for _, obj := range objects {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		filePath := strings.TrimPrefix(obj.Key, bucketID+"/")
		if !pathMatchesPrefix(filePath, prefix) {
			continue
		}
		if _, ok := seen[normalizeSeenPath(filePath)]; ok {
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

		if err := fn(FileInfo{
			Path:        filePath,
			Size:        int64(obj.Size),
			ContentType: contentType,
			ModifiedAt:  modifiedAt,
		}); err != nil {
			return err
		}
	}

	return nil
}

func (fsm *FileSystemManager) putObjectFromReader(bucket, key string, reader io.Reader, contentType *string, metadata map[string]string) error {
	urlPath := fmt.Sprintf("%s/buckets/%s/objects/%s", fsm.objectStorageURL, bucket, key)
	log.Printf("[object-storage debug] putObjectFromReader start bucket=%s key=%s url=%s", bucket, key, urlPath)
	req, err := http.NewRequest("PUT", urlPath, reader)
	if err != nil {
		return err
	}

	if contentType != nil {
		req.Header.Set("Content-Type", *contentType)
	}
	for k, v := range metadata {
		req.Header.Set("x-object-meta-"+k, v)
	}

	resp, err := fsm.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("object storage upload failed (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

func (fsm *FileSystemManager) WalkBucketFileContentBatches(ctx context.Context, bucketID, prefix string, maxBytes int64, fn func([]FileContentItem) error) error {
	if maxBytes <= 0 {
		maxBytes = maxFileBatchSize
	}

	accumulator := &contentBatchAccumulator{
		maxBytes: maxBytes,
		flush:    fn,
	}

	err := fsm.WalkBucketFiles(ctx, bucketID, prefix, func(file FileInfo) error {
		_, data, err := fsm.GetBucketFile(ctx, bucketID, file.Path)
		if err != nil {
			return nil
		}

		return accumulator.Add(FileContentItem{
			Info:    file,
			Content: data.Content,
		})
	})
	if err != nil {
		return err
	}

	return accumulator.Flush()
}

func (fsm *FileSystemManager) GetBucketFile(ctx context.Context, bucketID, filePath string) (*FileInfo, *FileData, error) {
	filePath = canonicalFilePath(filePath)
	redisKey := redisFileKey(bucketID, filePath)

	result, err := fsm.redis.Get(ctx, redisKey).Result()
	if err != nil {
		legacyRedisKey := fmt.Sprintf("bucket:%s:file:%s", bucketID, strings.TrimPrefix(filePath, "/"))
		result, err = fsm.redis.Get(ctx, legacyRedisKey).Result()
	}
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

	obj, err := fsm.objectStorage.GetObject(fsm.bucketName, objectStorageKey(bucketID, filePath))
	if err != nil {
		obj, err = fsm.objectStorage.GetObject(fsm.bucketName, fmt.Sprintf("%s/%s", bucketID, filePath))
	}
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

	if shouldBufferInRedis(len(content)) {
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
	filePath = canonicalFilePath(filePath)

	if !shouldBufferInRedis(len(content)) {
		objectKey := objectStorageKey(bucketID, filePath)
		log.Printf("[object-storage debug] PutBucketFile direct-put bucket_id=%s path=%s key=%s size=%d content_type=%s", bucketID, filePath, objectKey, len(content), contentType)
		_, err := fsm.objectStorage.PutObject(fsm.bucketName, objectKey, content, &contentType, nil)
		if err != nil {
			log.Printf("[object-storage debug] PutBucketFile direct-put failed bucket_id=%s path=%s key=%s size=%d err=%v", bucketID, filePath, objectKey, len(content), err)
			return err
		}

		fsm.redis.Del(ctx,
			redisFileKey(bucketID, filePath),
			redisFlushKey(bucketID, filePath),
			fmt.Sprintf("bucket:%s:file:%s", bucketID, strings.TrimPrefix(filePath, "/")),
			fmt.Sprintf("flush:%s:%s", bucketID, strings.TrimPrefix(filePath, "/")),
		)
		return nil
	}

	redisKey := redisFileKey(bucketID, filePath)
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

	fsm.redis.Set(ctx, redisFlushKey(bucketID, filePath), time.Now().Unix(), redisFlushDelay*2)

	return nil
}

func (fsm *FileSystemManager) DeleteBucketFile(ctx context.Context, bucketID, filePath string) error {
	filePath = canonicalFilePath(filePath)
	fsm.redis.Del(ctx,
		redisFileKey(bucketID, filePath),
		redisFlushKey(bucketID, filePath),
		fmt.Sprintf("bucket:%s:file:%s", bucketID, strings.TrimPrefix(filePath, "/")),
		fmt.Sprintf("flush:%s:%s", bucketID, strings.TrimPrefix(filePath, "/")),
	)

	_ = fsm.objectStorage.DeleteObject(fsm.bucketName, fmt.Sprintf("%s/%s", bucketID, filePath))
	return fsm.objectStorage.DeleteObject(fsm.bucketName, objectStorageKey(bucketID, filePath))
}

func (fsm *FileSystemManager) DeleteBucketPath(ctx context.Context, bucketID, filePath string) error {
	if !strings.HasPrefix(filePath, "/") {
		filePath = "/" + filePath
	}

	filePrefix := filePath
	if !strings.HasSuffix(filePrefix, "/") {
		filePrefix += "/"
	}

	queue := memoryQueue.NewBlockingJobQueue(15)

	pattern := fmt.Sprintf("bucket:%s:file:*", bucketID)
	iter := fsm.redis.Scan(ctx, 0, pattern, 100).Iterator()
	for iter.Next(ctx) {
		key := iter.Val()
		path := strings.TrimPrefix(key, fmt.Sprintf("bucket:%s:file:", bucketID))
		if path != filePath && !strings.HasPrefix(path, filePrefix) {
			continue
		}

		redisKey := key
		queue.AddAndBlockIfFull(func() error {
			fileKey := strings.TrimPrefix(redisKey, "bucket:")
			flushKey := "flush:" + fileKey
			return fsm.redis.Del(ctx, redisKey, flushKey).Err()
		})
	}
	if err := iter.Err(); err != nil {
		return err
	}

	objectPrefix := fmt.Sprintf("%s/%s", bucketID, filePath)
	objects, err := fsm.objectStorage.ListObjects(fsm.bucketName, &objectPrefix, nil)
	if err != nil {
		return err
	}

	for _, obj := range objects {
		objectKey := obj.Key
		fileObjectPath := strings.TrimPrefix(objectKey, bucketID+"/")
		if fileObjectPath != filePath && !strings.HasPrefix(fileObjectPath, filePrefix) {
			continue
		}

		queue.AddAndBlockIfFull(func() error {
			return fsm.objectStorage.DeleteObject(fsm.bucketName, objectKey)
		})
	}

	return queue.Wait()
}

func (fsm *FileSystemManager) GetBucketFiles(ctx context.Context, bucketID, prefix string) ([]FileInfo, error) {
	files := make([]FileInfo, 0)
	err := fsm.WalkBucketFiles(ctx, bucketID, prefix, func(file FileInfo) error {
		files = append(files, file)
		return nil
	})

	return files, err
}

func (fsm *FileSystemManager) GetBucketFilesAsZip(ctx context.Context, bucketId, prefix string) (*string, *time.Time, error) {
	tmpFile, err := os.CreateTemp("", "bucket-zip-*.zip")
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	hash := sha256.New()
	multiWriter := io.MultiWriter(tmpFile, hash)

	zipWriter := zip.NewWriter(multiWriter)

	err = fsm.WalkBucketFiles(ctx, bucketId, prefix, func(file FileInfo) error {
		_, data, err := fsm.GetBucketFile(ctx, bucketId, file.Path)
		if err != nil {
			return nil
		}

		f, err := zipWriter.Create(file.Path)
		if err != nil {
			return nil
		}

		_, err = f.Write(data.Content)
		return err
	})
	if err != nil {
		zipWriter.Close()
		return nil, nil, status.Errorf(codes.Internal, "failed to get files: %v", err)
	}

	if err := zipWriter.Close(); err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to close zip file: %v", err)
	}

	zipKey := fmt.Sprintf("zips/%x.zip", hash.Sum(nil))

	tmpFile.Seek(0, 0)

	contentType := "application/zip"
	err = fsm.putObjectFromReader(fsm.bucketName, zipKey, tmpFile, &contentType, nil)
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to upload zip: %v", err)
	}

	url := fmt.Sprintf("/download/%s/%s", fsm.bucketName, zipKey)

	redisKey := fmt.Sprintf("zip:%s", zipKey)
	fsm.redis.Set(ctx, redisKey, time.Now().Unix(), zipExpiration*2)

	expiresAt := time.Now().Add(zipExpiration)

	return &url, &expiresAt, nil
}

func (fsm *FileSystemManager) StreamBucketFilesAsZip(ctx context.Context, bucketId, prefix string, send ZipChunkSender) error {
	zipWriter := zip.NewWriter(&zipStreamWriter{
		ctx:  ctx,
		send: send,
	})

	err := fsm.WalkBucketFiles(ctx, bucketId, prefix, func(file FileInfo) error {
		select {
		case <-ctx.Done():
			zipWriter.Close()
			return ctx.Err()
		default:
		}

		_, data, err := fsm.GetBucketFile(ctx, bucketId, file.Path)
		if err != nil {
			return nil
		}

		f, err := zipWriter.Create(file.Path)
		if err != nil {
			zipWriter.Close()
			return status.Errorf(codes.Internal, "failed to create zip entry: %v", err)
		}

		if _, err := f.Write(data.Content); err != nil {
			zipWriter.Close()
			return status.Errorf(codes.Internal, "failed to write zip entry: %v", err)
		}
		return nil
	})
	if err != nil {
		return status.Errorf(codes.Internal, "failed to stream files as zip: %v", err)
	}

	if err := zipWriter.Close(); err != nil {
		return status.Errorf(codes.Internal, "failed to close zip stream: %v", err)
	}

	return nil
}

func (fsm *FileSystemManager) Clone(ctx context.Context, sourceBucketId, newBucketId string) error {
	select {
	case fsm.importSemaphore <- struct{}{}:
		defer func() { <-fsm.importSemaphore }()
	case <-ctx.Done():
		return ctx.Err()
	}

	queue := memoryQueue.NewBlockingJobQueue(15)

	err := fsm.WalkBucketFiles(ctx, sourceBucketId, "", func(file FileInfo) error {
		f := file
		queue.AddAndBlockIfFull(func() error {
			info, content, err := fsm.GetBucketFile(ctx, sourceBucketId, f.Path)
			if err != nil && !strings.Contains(err.Error(), "not found") {
				return err
			}
			if err != nil {
				return nil
			}

			return fsm.PutBucketFile(ctx, newBucketId, f.Path, content.Content, info.ContentType)

		})
		return nil
	})
	if err != nil {
		return status.Errorf(codes.NotFound, "source bucket not found: %v", err)
	}

	return queue.Wait()
}

func (fsm *FileSystemManager) ImportZip(ctx context.Context, newBucketId string, iterator zipImporter.Importer) error {
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
	if err := iterator.Err(); err != nil {
		return err
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
