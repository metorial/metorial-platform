// Package gitremote learns a remote branch's tree (paths, modes, blob SHAs, no file
// contents) over git smart HTTP with a blobless fetch, using go-git plumbing only: no
// git binary, no worktree, no local repository.
package gitremote

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const (
	DefaultMaxAdvertisementBytes int64 = 10 << 20
	DefaultMaxPackBytes          int64 = 256 << 20
	// An incremental fetch may carry every commit since the cached one (or, after a
	// history rewrite, much more); past this it is abandoned for a full fetch.
	DefaultMaxIncrementalPackBytes int64 = 32 << 20
	DefaultMaxObjects                    = 2_000_000
)

var (
	ErrBranchMissing = errors.New("gitremote: branch not found")
	// ErrFilterUnsupported means the server doesn't offer blob filtering; callers fall
	// back to the provider's tree API.
	ErrFilterUnsupported = errors.New("gitremote: server does not support blob filters")
	ErrTooLarge          = errors.New("gitremote: response exceeds the configured limits")
	// ErrRedirect means the server redirected to another host; credentials are never
	// forwarded across hosts.
	ErrRedirect = errors.New("gitremote: refused cross-host redirect")
)

type FetchOptions struct {
	// URL is the repository's smart-HTTP URL, e.g. https://github.com/owner/repo.git.
	URL    string
	Branch string
	// AuthHeader is the complete Authorization header value. It is only ever sent in
	// that header and never logged.
	AuthHeader string

	// Have lists commits whose trees are already known (the cached remote state), so
	// the server only sends trees that changed since. Base is the listing of Have[0].
	Have []string
	Base *remotestate.Listing

	MaxAdvertisementBytes int64
	MaxPackBytes          int64
	// MaxIncrementalPackBytes caps a fetch that sends Have.
	MaxIncrementalPackBytes int64
	MaxObjects              int
	// MaxObjectBytes caps a single inflated commit or tree (and delta), against zip
	// bombs; MaxInflatedBytes caps everything inflated while reading the pack.
	MaxObjectBytes   int64
	MaxInflatedBytes int64
	// MaxEntries caps the listing, so a tiny pack of repeated subtrees can't expand
	// into an enormous listing.
	MaxEntries int
	Timeout    time.Duration

	// AllowUnfiltered fetches blobs too (deepen 1, no filter) when the server doesn't
	// support filter; otherwise the fetch fails with ErrFilterUnsupported.
	AllowUnfiltered bool
	// DisableProtocolV2 sticks to protocol v0, e.g. to exercise it in tests.
	DisableProtocolV2 bool
	// AllowHTTP permits plain-HTTP URLs; tests only.
	AllowHTTP bool

	HTTPClient *http.Client
}

type Fetcher interface {
	FetchRemoteState(ctx context.Context, opts FetchOptions) (listing *remotestate.Listing, commitSha, treeSha string, err error)
}
