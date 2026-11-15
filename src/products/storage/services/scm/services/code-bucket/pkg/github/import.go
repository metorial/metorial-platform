package github

import (
	"context"
	"fmt"
	"log"

	"strings"

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
			"GitHub import", item.Path, pointer.Size, filelimit.MaxBufferedFileBytes,
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

func checkRepoFileSizes(ctx context.Context, opts DownloadOptions) error {
	url := fmt.Sprintf(
		"%s/repos/%s/%s/git/trees/%s?recursive=1",
		opts.BaseURL, opts.Owner, opts.Repo, opts.Ref,
	)

	tree, err := githubJSON[githubTreeResponse](ctx, "GET", url, opts.Token, nil)
	if err != nil {
		log.Printf(
			"[github import] size preflight skipped repo=%s/%s ref=%s err=%v",
			opts.Owner, opts.Repo, opts.Ref, err,
		)
		return nil
	}
	if tree.Truncated {
		log.Printf(
			"[github import] size preflight truncated repo=%s/%s ref=%s",
			opts.Owner, opts.Repo, opts.Ref,
		)
		return nil
	}

	for _, entry := range tree.Tree {
		if entry.Type != "blob" || entry.Size <= filelimit.MaxBufferedFileBytes {
			continue
		}

		if !pathWithinImport(entry.Path, opts.Path) {
			continue
		}

		log.Printf(
			"[github import] rejected before download repo=%s/%s ref=%s path=%s size=%d limit=%d",
			opts.Owner, opts.Repo, opts.Ref, entry.Path, entry.Size, filelimit.MaxBufferedFileBytes,
		)
		return filelimit.FileTooLargeError(
			"GitHub import", entry.Path, entry.Size, filelimit.MaxBufferedFileBytes,
		)
	}

	return nil
}

func pathWithinImport(entryPath, target string) bool {
	target = strings.Trim(target, "/")
	if target == "" {
		return true
	}

	entryPath = strings.TrimPrefix(entryPath, "/")
	return entryPath == target || strings.HasPrefix(entryPath, target+"/")
}

func DownloadRepo(ctx context.Context, opts DownloadOptions) (*RepoIterator, error) {
	opts = opts.withDefaults()

	if err := checkRepoFileSizes(ctx, opts); err != nil {
		return nil, err
	}

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
