package bitbucket

import (
	"context"
	"errors"
	"io"
	"reflect"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote/gittest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
)

func collect(t *testing.T, iter FileIterator) []FileToUpload {
	t.Helper()
	var files []FileToUpload
	if err := iter(func(file FileToUpload) error {
		files = append(files, file)
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	return files
}

func TestSourceFilesParity(t *testing.T) {
	files := map[string]string{
		"plugins/a/SKILL.md":              "a\n",
		"plugins/b/SKILL.md":              "b\n",
		"plugins/b/copy.md":               "a\n",
		".claude-plugin/marketplace.json": "{}",
	}
	manifests := gittest.NewManifests(t, manifestScope)
	opened := manifests.Open(files)

	bucket := collect(t, SourceFiles(context.Background(), "Bitbucket Cloud", gittest.BucketSource(files)))
	fromManifest := collect(t, SourceFiles(context.Background(), "Bitbucket Cloud", opened.Source(manifests.Storage)))

	if !reflect.DeepEqual(bucket, fromManifest) || len(bucket) != len(files) {
		t.Fatalf("bucket %v\nmanifest %v", bucket, fromManifest)
	}
}

type oversizedSource struct{}

func (oversizedSource) Walk(ctx context.Context, fn func(manifest.SourceFile) error) error {
	return fn(manifest.SourceFile{
		Path: "plugins/big/model.bin",
		Size: filelimit.MaxBufferedFileBytes + 1,
		Open: func(context.Context) (io.ReadCloser, error) { panic("oversized content must not be read") },
	})
}

func TestSourceFilesFileTooLarge(t *testing.T) {
	err := SourceFiles(context.Background(), "Bitbucket Data Center", oversizedSource{})(func(FileToUpload) error { return nil })

	exportErr, ok := export.As(err)
	if !ok || exportErr.Code != export.CodeFileTooLarge || exportErr.Details.Path != "plugins/big/model.bin" || exportErr.Details.Size != filelimit.MaxBufferedFileBytes+1 {
		t.Fatalf("err = %v, want file_too_large naming the path and size", err)
	}
	if !errors.Is(err, filelimit.ErrFileTooLarge) {
		t.Fatal("legacy error classification no longer recognises the error")
	}
}
