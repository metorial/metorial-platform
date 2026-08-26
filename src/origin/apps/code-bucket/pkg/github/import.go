package github

import (
	"context"
	"fmt"
	"log"

	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
	zipImporter "github.com/metorial/metorial/services/code-bucket/pkg/zip-importer"
)

type RepoIterator struct {
	inner *zipImporter.ZipFileIterator
	lfs   *gitlfs.Client

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

	if !gitlfs.LooksLikePointer(item.Content) {
		return item, true
	}
	pointer, isPointer := gitlfs.ParsePointer(item.Content)
	if !isPointer {
		return item, true
	}

	if pointer.Size > filelimit.MaxBufferedFileBytes {
		log.Printf(
			"[github import] rejected path=%s oid=%s size=%d limit=%d",
			item.Path, pointer.OID, pointer.Size, filelimit.MaxBufferedFileBytes,
		)
		it.err = filelimit.FileTooLargeError(
			"GitHub", item.Path, pointer.Size, filelimit.MaxBufferedFileBytes,
		)
		return nil, false
	}

	content, err := it.lfs.Download(it.ctx, "", pointer)
	if err != nil {
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
