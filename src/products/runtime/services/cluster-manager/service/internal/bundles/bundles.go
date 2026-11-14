package bundles

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"sync"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/access"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/metrics"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/objectstore"
)

const (
	ContentType  = "application/zstd"
	metaSHA256   = "sha256"
	metaVersion  = "version-id"
	keyPrefix    = "runtime/bundles/"
	keyExtension = ".tar.zst"
)

type Ref struct {
	Bucket    string
	Key       string
	SHA256    string
	SizeBytes int64
}

type Service struct {
	store   objectstore.Store
	buckets *access.Buckets
	bucket  string
	limits  Limits
	tempDir string
	cache   *DiskCache
	metrics *metrics.Metrics
	log     *slog.Logger

	mu       sync.Mutex
	inflight map[string]*importCall
}

type importCall struct {
	done chan struct{}
	ref  *Ref
	err  error
}

func NewService(store objectstore.Store, buckets *access.Buckets, bucket string, limits Limits, tempDir string, cache *DiskCache, m *metrics.Metrics, log *slog.Logger) *Service {
	return &Service{
		store:    store,
		buckets:  buckets,
		bucket:   bucket,
		limits:   limits,
		tempDir:  tempDir,
		cache:    cache,
		metrics:  m,
		log:      log,
		inflight: map[string]*importCall{},
	}
}

func Key(versionID string) string {
	sum := sha256.Sum256([]byte(versionID))
	return keyPrefix + hex.EncodeToString(sum[:]) + keyExtension
}

// Import repacks a build zip into the bundle bucket. It's idempotent by version ID: a bundle
// already stored for the version is returned as is, and concurrent imports of one version on
// this replica share a single repack.
func (s *Service) Import(ctx context.Context, versionID, bucket, key string) (*Ref, error) {
	if err := s.buckets.Check(access.UseFunctionsImport, bucket); err != nil {
		return nil, err
	}

	s.mu.Lock()
	if call, ok := s.inflight[versionID]; ok {
		s.mu.Unlock()
		select {
		case <-call.done:
			return call.ref, call.err
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	call := &importCall{done: make(chan struct{})}
	s.inflight[versionID] = call
	s.mu.Unlock()

	call.ref, call.err = s.importOnce(ctx, versionID, bucket, key)
	close(call.done)

	s.mu.Lock()
	delete(s.inflight, versionID)
	s.mu.Unlock()

	outcome := "ok"
	var invalidErr *InvalidError
	switch {
	case errors.As(call.err, &invalidErr):
		outcome = "invalid"
	case call.err != nil:
		outcome = "error"
	}
	s.metrics.BundleImports.WithLabelValues(outcome).Inc()
	return call.ref, call.err
}

func (s *Service) importOnce(ctx context.Context, versionID, bucket, key string) (*Ref, error) {
	target := Key(versionID)

	info, err := s.store.Head(ctx, s.bucket, target)
	if err == nil && info.Meta(metaSHA256) != "" {
		return &Ref{Bucket: s.bucket, Key: target, SHA256: info.Meta(metaSHA256), SizeBytes: info.Size}, nil
	}
	if err != nil && !errors.Is(err, objectstore.ErrNotFound) {
		return nil, fmt.Errorf("check existing bundle: %w", err)
	}

	zipFile, err := os.CreateTemp(s.tempDir, "bundle-*.zip")
	if err != nil {
		return nil, err
	}
	defer os.Remove(zipFile.Name())
	defer zipFile.Close()

	zipSize, err := s.download(ctx, bucket, key, zipFile)
	if err != nil {
		return nil, err
	}

	zr, err := zip.NewReader(zipFile, zipSize)
	if err != nil {
		return nil, invalid("not a zip archive: %v", err)
	}

	out, err := os.CreateTemp(s.tempDir, "bundle-*.tar.zst")
	if err != nil {
		return nil, err
	}
	defer os.Remove(out.Name())
	defer out.Close()

	hash := sha256.New()
	if _, err := Repack(zr, io.MultiWriter(out, hash), s.limits); err != nil {
		return nil, err
	}
	size, err := out.Seek(0, io.SeekCurrent)
	if err != nil {
		return nil, err
	}
	if _, err := out.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	sum := hex.EncodeToString(hash.Sum(nil))

	err = s.store.Put(ctx, s.bucket, target, out, size, ContentType, map[string]string{metaSHA256: sum, metaVersion: versionID})
	if err != nil {
		return nil, fmt.Errorf("store bundle: %w", err)
	}

	s.log.Info("imported bundle", "versionId", versionID, "key", target, "sizeBytes", size, "zipBytes", zipSize)
	return &Ref{Bucket: s.bucket, Key: target, SHA256: sum, SizeBytes: size}, nil
}

func (s *Service) download(ctx context.Context, bucket, key string, dst *os.File) (int64, error) {
	obj, err := s.store.Get(ctx, bucket, key)
	if errors.Is(err, objectstore.ErrNotFound) {
		return 0, invalid("source object %s/%s does not exist", bucket, key)
	}
	if err != nil {
		return 0, fmt.Errorf("read source archive: %w", err)
	}
	defer obj.Body.Close()

	if s.limits.MaxZipBytes > 0 && obj.Size > s.limits.MaxZipBytes {
		return 0, invalid("archive is larger than %d bytes", s.limits.MaxZipBytes)
	}
	n, err := io.Copy(dst, io.LimitReader(obj.Body, s.limits.MaxZipBytes+1))
	if err != nil {
		return 0, fmt.Errorf("read source archive: %w", err)
	}
	if n > s.limits.MaxZipBytes {
		return 0, invalid("archive is larger than %d bytes", s.limits.MaxZipBytes)
	}
	return n, nil
}

// Serve streams a stored bundle, from the local disk cache when present.
func (s *Service) Serve(ctx context.Context, w http.ResponseWriter, bucket, key string) error {
	cacheName := bucket + "/" + key

	if f, size, ok := s.cache.Open(cacheName); ok {
		defer f.Close()
		s.metrics.BundleCache.WithLabelValues("hit").Inc()
		writeHeaders(w, size)
		_, err := io.Copy(w, f)
		return err
	}
	if s.cache.Enabled() {
		s.metrics.BundleCache.WithLabelValues("miss").Inc()
	}

	obj, err := s.store.Get(ctx, bucket, key)
	if err != nil {
		return err
	}
	defer obj.Body.Close()

	writeHeaders(w, obj.Size)

	cw := s.cache.Writer(cacheName, obj.Size)
	n, err := io.Copy(w, io.TeeReader(obj.Body, cw))
	if err != nil || (obj.Size >= 0 && n != obj.Size) {
		cw.Abort()
		if err == nil {
			err = fmt.Errorf("short bundle read: %d of %d bytes", n, obj.Size)
		}
		return err
	}
	cw.Commit()
	return nil
}

func writeHeaders(w http.ResponseWriter, size int64) {
	w.Header().Set("Content-Type", ContentType)
	if size >= 0 {
		w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	}
	w.WriteHeader(http.StatusOK)
}
