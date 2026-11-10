package github

import (
	"context"
	"fmt"
	"net/http"
	"path"
	"strings"
	"sync"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const maxSubtreeRequests = 2000

type treeGetter func(ctx context.Context, sha string, recursive bool) (*githubTreeResponse, error)

type listedEntry struct {
	Path string
	Mode string
	Type string
	SHA  string
}

type treeLister struct {
	get      treeGetter
	include  func(dir string) bool
	requests int
	entries  []listedEntry
	complete bool
}

// listTree lists every entry below root. GitHub truncates recursive listings past
// 100,000 entries or 7 MB, so a truncated response is replaced by the top level plus a
// recursive listing per subtree, descending level by level wherever a subtree is still
// truncated. include (nil means all) limits which subtrees the fallback descends into;
// complete is false when it skipped any. More than maxSubtreeRequests subtree reads
// fail with tree_too_large.
func listTree(ctx context.Context, get treeGetter, root string, include func(dir string) bool) ([]listedEntry, bool, error) {
	resp, err := get(ctx, root, true)
	if err != nil {
		return nil, false, err
	}
	if !resp.Truncated {
		return appendListed(nil, "", resp), true, nil
	}

	l := &treeLister{get: get, include: include, complete: true}
	if err := l.level(ctx, "", root); err != nil {
		return nil, false, err
	}
	return l.entries, l.complete, nil
}

func appendListed(entries []listedEntry, prefix string, resp *githubTreeResponse) []listedEntry {
	for _, e := range resp.Tree {
		entries = append(entries, listedEntry{Path: joinTreePath(prefix, e.Path), Mode: e.Mode, Type: e.Type, SHA: e.SHA})
	}
	return entries
}

func joinTreePath(prefix, name string) string {
	if prefix == "" {
		return name
	}
	return prefix + "/" + name
}

func (l *treeLister) request(ctx context.Context, sha string, recursive bool) (*githubTreeResponse, error) {
	if l.requests >= maxSubtreeRequests {
		return nil, export.NewError(export.CodeTreeTooLarge, "the repository tree needs more than %d subtree listings", maxSubtreeRequests)
	}
	l.requests++
	return l.get(ctx, sha, recursive)
}

func (l *treeLister) level(ctx context.Context, prefix, sha string) error {
	resp, err := l.request(ctx, sha, false)
	if err != nil {
		return err
	}
	if resp.Truncated {
		return export.NewError(export.CodeTreeTooLarge, "the tree at %q has too many entries to list", prefix)
	}

	for _, e := range resp.Tree {
		full := joinTreePath(prefix, e.Path)
		l.entries = append(l.entries, listedEntry{Path: full, Mode: e.Mode, Type: e.Type, SHA: e.SHA})
		if e.Type != "tree" {
			continue
		}
		if l.include != nil && !l.include(full) {
			l.complete = false
			continue
		}

		sub, err := l.request(ctx, e.SHA, true)
		if err != nil {
			return err
		}
		if !sub.Truncated {
			l.entries = appendListed(l.entries, full, sub)
			continue
		}
		if err := l.level(ctx, full, e.SHA); err != nil {
			return err
		}
	}
	return nil
}

func listingFromEntries(commit string, entries []listedEntry) (*remotestate.Listing, error) {
	converted := make([]remotestate.Entry, 0, len(entries))
	for _, e := range entries {
		mode, err := remotestate.ParseMode(e.Mode)
		if err != nil {
			return nil, fmt.Errorf("tree entry %s: %w", e.Path, err)
		}
		converted = append(converted, remotestate.Entry{Path: e.Path, Mode: mode, SHA: e.SHA})
	}
	return remotestate.FromEntries(commit, converted)
}

// manifestDirs decides which subtrees a truncated listing descends into: those holding
// manifest paths or intersecting the managed scope. Everything else keeps its tree SHA
// without being listed.
func manifestDirs(ctx context.Context, m *manifest.Manifest) func(dir string) bool {
	var (
		once sync.Once
		dirs map[string]bool
	)

	return func(dir string) bool {
		once.Do(func() {
			dirs = map[string]bool{}
			_ = m.Walk(ctx, func(e manifest.Entry) error {
				for parent := path.Dir(e.Path); parent != "." && !dirs[parent]; parent = path.Dir(parent) {
					dirs[parent] = true
				}
				return nil
			})
		})

		if dirs[dir] {
			return true
		}
		scope := m.Header.Scope
		for _, d := range scope.Dirs {
			if d == dir || strings.HasPrefix(d, dir+"/") || strings.HasPrefix(dir, d+"/") {
				return true
			}
		}
		for _, f := range scope.Files {
			if strings.HasPrefix(f, dir+"/") {
				return true
			}
		}
		for _, g := range scope.Globs {
			if globCoversDir(g, dir) {
				return true
			}
		}
		return false
	}
}

func globCoversDir(glob, dir string) bool {
	globSegments := strings.Split(glob, "/")
	dirSegments := strings.Split(dir, "/")
	if len(dirSegments) >= len(globSegments) {
		return false
	}
	for i, segment := range dirSegments {
		if ok, _ := path.Match(globSegments[i], segment); !ok {
			return false
		}
	}
	return true
}

// remoteReader learns the remote tree with a blobless git fetch (no API rate limit,
// never truncated, incremental against the cached commit) and falls back to the REST
// tree API when the fetch isn't available.
type remoteReader struct {
	api     *restClient
	fetcher gitremote.Fetcher
	fetch   gitremote.FetchOptions
	include func(dir string) bool
	logf    func(format string, args ...any)
}

func (r *remoteReader) ReadRemote(ctx context.Context, commitSHA, treeSHA string, base *remotestate.Listing) (*remotestate.Listing, bool, error) {
	if r.fetcher != nil {
		opts := r.fetch
		if base != nil && base.CommitSHA != "" {
			opts.Have = []string{base.CommitSHA}
			opts.Base = base
		}

		listing, _, fetchedTree, err := r.fetcher.FetchRemoteState(ctx, opts)
		switch {
		case err != nil:
			r.logf("[github manifest export] blobless fetch failed, listing the tree over REST: %v", err)
		case fetchedTree != treeSHA:
			r.logf("[github manifest export] branch moved during the fetch (%s, expected %s), listing over REST", fetchedTree, treeSHA)
		default:
			return listing, true, nil
		}
	}

	entries, complete, err := listTree(ctx, r.getTree, treeSHA, r.include)
	if err != nil {
		return nil, false, err
	}
	listing, err := listingFromEntries(commitSHA, entries)
	if err != nil {
		return nil, false, err
	}
	return listing, complete, nil
}

func (r *remoteReader) getTree(ctx context.Context, sha string, recursive bool) (*githubTreeResponse, error) {
	endpoint := fmt.Sprintf("%s/git/trees/%s", r.api.repoURL, sha)
	if recursive {
		endpoint += "?recursive=1"
	}

	var resp githubTreeResponse
	if err := r.api.do(ctx, http.MethodGet, endpoint, nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func legacyTreeGetter(repoURL, token string) treeGetter {
	return func(ctx context.Context, sha string, recursive bool) (*githubTreeResponse, error) {
		endpoint := fmt.Sprintf("%s/git/trees/%s", repoURL, sha)
		if recursive {
			endpoint += "?recursive=1"
		}
		return githubJSON[githubTreeResponse](ctx, "GET", endpoint, token, nil)
	}
}
