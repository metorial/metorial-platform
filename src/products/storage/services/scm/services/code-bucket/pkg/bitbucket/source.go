package bitbucket

import (
	"context"
	"fmt"
	"io"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
)

// UploadSourceToCloudRepo runs the legacy Bitbucket Cloud export over any file source:
// a code bucket (fs.BucketFileSource) or a manifest.
func UploadSourceToCloudRepo(ctx context.Context, opts CloudUploadOptions, source manifest.FileSource) error {
	return UploadToCloudRepo(opts, SourceFiles(ctx, "Bitbucket Cloud", source))
}

// UploadSourceToDataCenterRepo runs the legacy Bitbucket Data Center export over any
// file source.
func UploadSourceToDataCenterRepo(ctx context.Context, opts DataCenterUploadOptions, source manifest.FileSource) error {
	return UploadToDataCenterRepo(ctx, opts, SourceFiles(ctx, "Bitbucket Data Center", source))
}

// SourceFiles reads a file source into the legacy exporters' buffered iterator. Files
// over the buffered-export cap fail with file_too_large naming the path and size.
func SourceFiles(ctx context.Context, provider string, source manifest.FileSource) FileIterator {
	return func(yield func(FileToUpload) error) error {
		return source.Walk(ctx, func(file manifest.SourceFile) error {
			if file.Size > filelimit.MaxBufferedFileBytes {
				return fileTooLarge(provider, file.Path, file.Size)
			}

			body, err := file.Open(ctx)
			if err != nil {
				return err
			}
			content, err := io.ReadAll(io.LimitReader(body, filelimit.MaxBufferedFileBytes+1))
			body.Close()
			if err != nil {
				return err
			}
			if int64(len(content)) > filelimit.MaxBufferedFileBytes {
				return fileTooLarge(provider, file.Path, int64(len(content)))
			}
			return yield(FileToUpload{Path: file.Path, Content: content})
		})
	}
}

func fileTooLarge(provider, path string, size int64) error {
	err := export.FileTooLarge(path, size, filelimit.MaxBufferedFileBytes)
	err.Err = fmt.Errorf("%s export: %w", provider, filelimit.ErrFileTooLarge)
	return err
}
