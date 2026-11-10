// Package gitpush writes commits to a branch over git smart HTTP by building the tree
// and commit objects locally and streaming a packfile into git-receive-pack. It uses
// go-git plumbing only: no git binary, no worktree, no local repository.
package gitpush

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const maxAttributesBytes = 1 << 20

// Tracker follows a branch's tree across commits. It implements export.RemoteReader
// and the Head half of commitbatch.CommitWriter for git-transport exporters.
type Tracker struct {
	Fetch      gitremote.FetchOptions
	MaxEntries int
	Logf       func(format string, args ...any)

	client gitremote.Client
	// state is a tree the server confirmed (fetched, cached and verified, or pushed
	// by us as objects).
	state *gitremote.State
	// expected is what the last commit should have produced; it is only trusted once
	// the branch head is seen at expected.Commit, and only verified if pushed by us.
	expected         *gitremote.State
	expectedVerified bool
}

func NewTracker(fetch gitremote.FetchOptions) *Tracker {
	return &Tracker{Fetch: fetch, Logf: log.Printf}
}

// SeedFromCache loads Origin's cached listing into the tracker, so an unchanged head
// costs no fetch, and returns options whose ListingStore serves that listing again
// from memory to export.Sync.
func (t *Tracker) SeedFromCache(ctx context.Context, opts export.ManifestOptions) export.ManifestOptions {
	state, opts := LoadCache(ctx, opts, t.MaxEntries, t.Logf)
	if state != nil {
		t.state = state
	}
	return opts
}

// LoadCache reads Origin's cached listing as a State (nil if there is none or it
// doesn't hash to the cached tree) and memoizes it in the returned options.
func LoadCache(ctx context.Context, opts export.ManifestOptions, maxEntries int, logf func(string, ...any)) (*gitremote.State, export.ManifestOptions) {
	cached := opts.RemoteState
	if cached == nil || opts.Listings == nil {
		return nil, opts
	}

	listing, err := opts.Listings.Load(ctx, *cached)
	if err != nil {
		logf("[gitpush] ignoring remote-state cache %s: %v", cached.ListingKey, err)
		return nil, opts
	}

	state, err := gitremote.StateFromListing(listing)
	if err != nil || state.TreeSHA() != cached.TreeSHA {
		logf("[gitpush] cached listing %s doesn't hash to tree %s; ignoring it", cached.ListingKey, cached.TreeSHA)
		return nil, opts
	}
	state.Commit = cached.CommitSHA

	opts.Listings = &memoListings{ListingStore: opts.Listings, ref: *cached, state: state, maxEntries: maxEntries}
	return state, opts
}

type memoListings struct {
	export.ListingStore
	ref        export.RemoteState
	state      *gitremote.State
	maxEntries int
}

func (m *memoListings) Load(ctx context.Context, ref export.RemoteState) (*remotestate.Listing, error) {
	if ref == m.ref {
		listing, err := m.state.Listing(m.maxEntries)
		if err == nil {
			listing.CommitSHA = ref.CommitSHA
		}
		return listing, err
	}
	return m.ListingStore.Load(ctx, ref)
}

// Expect records the state a commit in flight should produce. verified means the
// commit's objects are exactly ours (a push), so seeing it at the head proves the tree.
func (t *Tracker) Expect(next *gitremote.State, verified bool) {
	t.expected, t.expectedVerified = next, verified
}

// Confirm makes next the known state, after the server accepted it.
func (t *Tracker) Confirm(next *gitremote.State) {
	t.state, t.expected = next, nil
}

func (t *Tracker) Head(ctx context.Context) (string, string, error) {
	head, err := t.client.ResolveBranch(ctx, t.Fetch)
	if err != nil {
		return "", "", mapFetchError(err)
	}

	switch {
	case t.state != nil && t.state.Commit == head:
		return head, t.state.TreeSHA(), nil
	case t.expected != nil && t.expected.Commit == head && t.expectedVerified:
		t.Confirm(t.expected)
		return head, t.state.TreeSHA(), nil
	}

	state, err := t.fetch(ctx, head)
	if err != nil {
		return "", "", err
	}
	if t.expected != nil && t.expected.Commit == head && t.expected.Root != state.Root {
		t.Logf("[gitpush] commit %s has tree %s, expected %s", head, state.TreeSHA(), t.expected.TreeSHA())
	}
	t.Confirm(state)
	return head, state.TreeSHA(), nil
}

func (t *Tracker) fetch(ctx context.Context, commit string) (*gitremote.State, error) {
	state, err := t.client.FetchCommit(ctx, t.Fetch, commit, t.state)
	if err != nil {
		return nil, mapFetchError(err)
	}
	return state, nil
}

// StateAt returns the tree at commit: the known state, the expected one (good enough
// to decide what a write does; it is verified before it is cached) or a fetch.
func (t *Tracker) StateAt(ctx context.Context, commit string) (*gitremote.State, error) {
	switch {
	case t.state != nil && t.state.Commit == commit:
		return t.state, nil
	case t.expected != nil && t.expected.Commit == commit:
		return t.expected, nil
	}

	state, err := t.fetch(ctx, commit)
	if err != nil {
		return nil, err
	}
	t.Confirm(state)
	return state, nil
}

func (t *Tracker) ReadRemote(ctx context.Context, commit, treeSHA string, base *remotestate.Listing) (*remotestate.Listing, bool, error) {
	if t.state == nil && base != nil && base.CommitSHA != "" {
		if seeded, err := gitremote.StateFromListing(base); err == nil {
			seeded.Commit = base.CommitSHA
			t.state = seeded
		}
	}

	state, err := t.StateAt(ctx, commit)
	if err != nil {
		return nil, false, err
	}
	if t.state != state {
		if state, err = t.fetch(ctx, commit); err != nil {
			return nil, false, err
		}
		t.Confirm(state)
	}

	listing, err := state.Listing(t.MaxEntries)
	if err != nil {
		return nil, false, mapFetchError(err)
	}
	return listing, true, nil
}

// ReadBlob fetches an existing blob (only .gitattributes is ever read).
func (t *Tracker) ReadBlob(ctx context.Context, sha string) ([]byte, error) {
	data, err := t.client.ReadBlob(ctx, t.Fetch, sha, maxAttributesBytes)
	if err != nil {
		return nil, mapFetchError(err)
	}
	return data, nil
}

func mapFetchError(err error) error {
	switch {
	case errors.Is(err, gitremote.ErrBranchMissing):
		return fmt.Errorf("%w: %w", commitbatch.ErrBranchMissing, err)
	case errors.Is(err, gitremote.ErrTooLarge):
		return &export.Error{Code: export.CodeTreeTooLarge, Message: err.Error(), Err: err}
	}
	return err
}
