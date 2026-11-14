package gitlab

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitpush"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const (
	treePageSize       = 100
	maxAttributesBytes = 1 << 20
)

// remote knows the branch's tree at the commits the export touches. It reads it with
// a blobless git fetch and falls back to the paginated REST tree API for good when git
// over HTTP is unavailable (filters disabled, token without repository scope, ...).
type remote struct {
	api        *apiClient
	branch     string
	git        *gitpush.Tracker
	maxEntries int
	logf       func(format string, args ...any)

	state            *gitremote.State
	expected         *gitremote.State
	expectedVerified bool
}

func (r *remote) useREST(err error) {
	r.logf("[gitlab] git transport unavailable, using the REST tree API: %v", err)
	r.git = nil
}

func gitUnavailable(err error) bool {
	var httpErr *gitremote.HTTPError
	return errors.Is(err, gitremote.ErrFilterUnsupported) ||
		errors.Is(err, gitremote.ErrUnauthorized) ||
		errors.Is(err, gitremote.ErrRepositoryNotFound) ||
		errors.Is(err, gitremote.ErrRedirect) ||
		errors.Is(err, gitremote.ErrProtocol) ||
		errors.As(err, &httpErr)
}

// seed loads Origin's cached listing (through the git tracker when there is one, so
// it can offer the cached commit as a have).
func (r *remote) seed(ctx context.Context, opts export.ManifestOptions) export.ManifestOptions {
	if r.git != nil {
		return r.git.SeedFromCache(ctx, opts)
	}
	state, opts := gitpush.LoadCache(ctx, opts, r.maxEntries, r.logf)
	if state != nil {
		r.state = state
	}
	return opts
}

func (r *remote) Head(ctx context.Context) (string, string, error) {
	if r.git != nil {
		head, tree, err := r.git.Head(ctx)
		if !gitUnavailable(err) {
			return head, tree, err
		}
		r.useREST(err)
	}

	head, err := r.api.branchHead(ctx, r.branch)
	if err != nil {
		return "", "", err
	}
	switch {
	case r.state != nil && r.state.Commit == head:
		return head, r.state.TreeSHA(), nil
	case r.expected != nil && r.expected.Commit == head && r.expectedVerified:
		return head, r.expected.TreeSHA(), nil
	}
	return head, "", nil
}

func (r *remote) ReadRemote(ctx context.Context, commit, treeSHA string, base *remotestate.Listing) (*remotestate.Listing, bool, error) {
	if r.git != nil {
		listing, complete, err := r.git.ReadRemote(ctx, commit, treeSHA, base)
		if !gitUnavailable(err) {
			return listing, complete, err
		}
		r.useREST(err)
	}

	state, err := r.restState(ctx, commit)
	if err != nil {
		return nil, false, err
	}
	listing, err := state.Listing(r.maxEntries)
	if err != nil {
		return nil, false, err
	}
	return listing, true, nil
}

// StateAt returns the tree at commit, preferring what the last commit should have
// produced over another read.
func (r *remote) StateAt(ctx context.Context, commit string) (*gitremote.State, error) {
	if r.git != nil {
		state, err := r.git.StateAt(ctx, commit)
		if !gitUnavailable(err) {
			return state, err
		}
		r.useREST(err)
	}

	switch {
	case r.state != nil && r.state.Commit == commit:
		return r.state, nil
	case r.expected != nil && r.expected.Commit == commit:
		return r.expected, nil
	}
	return r.restState(ctx, commit)
}

func (r *remote) expect(next *gitremote.State) {
	if r.git != nil {
		r.git.Expect(next, false)
		return
	}
	r.expected, r.expectedVerified = next, false
}

func (r *remote) ReadBlob(ctx context.Context, sha string) ([]byte, error) {
	if r.git != nil {
		data, err := r.git.ReadBlob(ctx, sha)
		if err == nil {
			return data, nil
		}
		r.logf("[gitlab] reading blob %s over git failed, using the REST API: %v", sha, err)
	}
	return r.api.rawBlob(ctx, sha, maxAttributesBytes)
}

type treeEntry struct {
	ID   string `json:"id"`
	Type string `json:"type"`
	Path string `json:"path"`
	Mode string `json:"mode"`
}

func (r *remote) restState(ctx context.Context, commit string) (*gitremote.State, error) {
	listing, err := r.restListing(ctx, commit)
	if err != nil {
		return nil, err
	}
	state, err := gitremote.StateFromListing(listing)
	if err != nil {
		return nil, err
	}
	state.Commit = commit
	r.state = state
	return state, nil
}

// restListing pages through GET /repository/tree?recursive=true, using keyset
// pagination where the instance supports it and following the Link header.
func (r *remote) restListing(ctx context.Context, commit string) (*remotestate.Listing, error) {
	query := url.Values{
		"ref":        {commit},
		"recursive":  {"true"},
		"per_page":   {fmt.Sprint(treePageSize)},
		"pagination": {"keyset"},
	}
	next := r.api.projectURL("/repository/tree?" + query.Encode())

	listing := remotestate.New()
	listing.CommitSHA = commit
	for next != "" {
		var page []treeEntry
		header, err := r.api.get(ctx, "repository tree", next, &page)
		var apiErr *APIError
		if errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusNotFound {
			return listing, nil
		}
		if err != nil {
			return nil, err
		}

		for _, entry := range page {
			if entry.Type == "tree" {
				continue
			}
			mode, err := remotestate.ParseMode(strings.TrimLeft(entry.Mode, "0"))
			if err != nil {
				return nil, fmt.Errorf("GitLab tree entry %s: %w", entry.Path, err)
			}
			if err := listing.Add(remotestate.Entry{Path: entry.Path, Mode: mode, SHA: entry.ID}); err != nil {
				return nil, fmt.Errorf("GitLab tree entry %s: %w", entry.Path, err)
			}
			if r.maxEntries > 0 && listing.Len() > r.maxEntries {
				return nil, &export.Error{Code: export.CodeTreeTooLarge, Message: fmt.Sprintf("the repository has more than %d entries", r.maxEntries)}
			}
		}
		next = nextLink(header.Get("Link"))
	}
	return listing, nil
}

func nextLink(header string) string {
	for _, link := range strings.Split(header, ",") {
		target, params, ok := strings.Cut(strings.TrimSpace(link), ";")
		if !ok || !strings.Contains(params, `rel="next"`) {
			continue
		}
		return strings.Trim(strings.TrimSpace(target), "<>")
	}
	return ""
}
