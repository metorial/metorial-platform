package github

import (
	"context"
	"fmt"

	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
	zipImporter "github.com/metorial/metorial/services/code-bucket/pkg/zip-importer"
)

// RepoIterator yields repository files with Git LFS pointers resolved back into
// their real contents. The zipball only ever contains the pointer text, so
// without this an exported large file would come back as ~130 bytes.
type RepoIterator struct {
	inner *zipImporter.ZipFileIterator
	lfs   *gitlfs.Client

	// ctx is held rather than passed because the Importer interface has no place
	// for it. The iterator is consumed by a single caller for a single import.
	ctx context.Context
	err error
}

func (it *RepoIterator) Next() (*zipImporter.ZipFileItem, bool) {
	if it.err != nil {
		return nil, false
	}

	item, ok := it.inner.Next()
	if !ok {
		return nil, false
	}

	// Pointers are tiny, so the size check rules out almost every file before
	// the parse runs.
	if !gitlfs.LooksLikePointer(item.Content) {
		return item, true
	}
	pointer, isPointer := gitlfs.ParsePointer(item.Content)
	if !isPointer {
		return item, true
	}

	content, err := it.lfs.Download(it.ctx, "", pointer)
	if err != nil {
		// Storing the pointer would silently corrupt the bucket, so stop here and
		// let the caller surface the failure.
		it.err = fmt.Errorf("failed to resolve Git LFS object for %s: %w", item.Path, err)
		return nil, false
	}

	item.Content = content
	return item, true
}

func (it *RepoIterator) Err() error {
	if it.err != nil {
		return it.err
	}
	return it.inner.Err()
}

func (it *RepoIterator) Close() error {
	return it.inner.Close()
}

func DownloadRepo(ctx context.Context, opts DownloadOptions) (*RepoIterator, error) {
	opts = opts.withDefaults()

	url := fmt.Sprintf("%s/repos/%s/%s/zipball/%s", opts.BaseURL, opts.Owner, opts.Repo, opts.Ref)

	headers := map[string]string{
		"Accept": "*/*",
	}

	if opts.Token != "" {
		headers["Authorization"] = fmt.Sprintf("Bearer %s", opts.Token)
	}

	inner, err := zipImporter.DownloadZipContext(ctx, url, opts.Path, headers)
	if err != nil {
		return nil, err
	}

	return &RepoIterator{
		inner: inner,
		lfs:   gitlfs.NewClient(opts.LFSEndpoint, "", opts.Token, transferClient),
		ctx:   ctx,
	}, nil
}
