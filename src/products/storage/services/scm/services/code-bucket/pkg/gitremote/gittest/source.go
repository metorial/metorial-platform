package gittest

import (
	"context"
	"io"
	"sort"
	"strings"

	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
)

// BucketSource is a FileSource like a code bucket's: no blob SHAs, content only.
type BucketSource map[string]string

func (s BucketSource) Walk(ctx context.Context, fn func(manifest.SourceFile) error) error {
	paths := make([]string, 0, len(s))
	for path := range s {
		paths = append(paths, path)
	}
	sort.Strings(paths)

	for _, path := range paths {
		content := s[path]
		err := fn(manifest.SourceFile{
			Path: path,
			Size: int64(len(content)),
			Open: func(context.Context) (io.ReadCloser, error) {
				return io.NopCloser(strings.NewReader(content)), nil
			},
		})
		if err != nil {
			return err
		}
	}
	return nil
}
