package gitlab

import (
	"context"
	"fmt"
	"io"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
)

// UploadSource runs the legacy GitLab export over any file source: a code bucket
// (fs.BucketFileSource) or a manifest. Content is read only for files that differ; a
// manifest's blob SHAs skip unchanged files without reading them. Files the buffered
// transport can't carry fail with file_too_large naming the path and size.
func UploadSource(ctx context.Context, opts UploadOptions, source manifest.FileSource) error {
	return uploadItems(opts, func(yield func(uploadItem) error) error {
		return source.Walk(ctx, func(file manifest.SourceFile) error {
			if file.Size > filelimit.MaxBufferedFileBytes {
				return fileTooLarge(file.Path, file.Size)
			}
			return yield(uploadItem{
				Path:       file.Path,
				GitBlobSHA: file.GitBlobSHA,
				Content:    func() ([]byte, error) { return readSourceFile(ctx, file) },
			})
		})
	})
}

func readSourceFile(ctx context.Context, file manifest.SourceFile) ([]byte, error) {
	body, err := file.Open(ctx)
	if err != nil {
		return nil, err
	}
	defer body.Close()

	content, err := io.ReadAll(io.LimitReader(body, filelimit.MaxBufferedFileBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(content)) > filelimit.MaxBufferedFileBytes {
		return nil, fileTooLarge(file.Path, int64(len(content)))
	}
	return content, nil
}

func fileTooLarge(path string, size int64) error {
	err := export.FileTooLarge(path, size, filelimit.MaxBufferedFileBytes)
	err.Err = fmt.Errorf("GitLab export: %w", filelimit.ErrFileTooLarge)
	return err
}
