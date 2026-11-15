package fs

import (
	"context"
	"io"
	"strings"

	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	objectstorage "github.com/metorial/object-storage/clients/go"
)

func (fsm *FileSystemManager) ObjectStorage() *objectstorage.Client {
	return fsm.objectStorage
}

// BucketName is the object-storage bucket that holds every code bucket's files.
func (fsm *FileSystemManager) BucketName() string {
	return fsm.bucketName
}

type bucketFileSource struct {
	fsm      *FileSystemManager
	bucketID string
}

// BucketFileSource exposes a code bucket as a manifest.FileSource so exporters can
// consume code buckets and manifests the same way.
func (fsm *FileSystemManager) BucketFileSource(bucketID string) manifest.FileSource {
	return &bucketFileSource{fsm: fsm, bucketID: bucketID}
}

func (s *bucketFileSource) Walk(ctx context.Context, fn func(manifest.SourceFile) error) error {
	return s.fsm.WalkBucketFiles(ctx, s.bucketID, "", func(file FileInfo) error {
		bucketPath := file.Path

		return fn(manifest.SourceFile{
			Path: strings.TrimPrefix(bucketPath, "/"),
			Size: file.Size,
			Open: func(ctx context.Context) (io.ReadCloser, error) {
				body, _, err := s.fsm.OpenBucketFile(ctx, s.bucketID, bucketPath)
				return body, err
			},
		})
	})
}
