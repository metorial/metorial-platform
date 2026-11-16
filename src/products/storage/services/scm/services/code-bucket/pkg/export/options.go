package export

import (
	"context"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const DefaultSlice = 600 * time.Second

type Guard struct {
	MaxUnexpectedDeletes     uint32
	MaxUnexpectedDeleteRatio float64
	AllowMassDelete          bool
}

// Tripped applies the deletion guard: both the count and the ratio of remote paths in
// scope must be exceeded, and allow_mass_delete overrides it.
func (g Guard) Tripped(unexpected, scopeEntries int) bool {
	if g.AllowMassDelete {
		return false
	}

	return unexpected > int(g.MaxUnexpectedDeletes) &&
		float64(unexpected) > g.MaxUnexpectedDeleteRatio*float64(scopeEntries)
}

// EffectiveLFSThreshold applies a transport's non-LFS file cap to a project's LFS
// threshold: files above the cap always go through Git LFS, and a threshold of zero or
// less (no project threshold) leaves LFS to exactly those files.
func EffectiveLFSThreshold(threshold, maxFileBytes int64) int64 {
	if threshold <= 0 || threshold > maxFileBytes {
		return maxFileBytes + 1
	}
	return threshold
}

// Tuning overrides provider batch limits; zero fields keep the provider default.
type Tuning struct {
	GraphQLMaxFileBytes int64
	RESTMaxBlobBytes    int64
	BatchInitialBytes   int64
	BatchMaxBytes       int64
}

type ListingStore interface {
	Load(ctx context.Context, ref RemoteState) (*remotestate.Listing, error)
	Save(ctx context.Context, keyPrefix string, listing *remotestate.Listing) (*RemoteState, error)
}

// ManifestOptions is the provider-independent part of a manifest export request.
type ManifestOptions struct {
	Manifest *manifest.Manifest
	// Previous is nil when the destination has no previous manifest; every scope delete
	// then counts as unexpected.
	Previous *manifest.Manifest
	Source   manifest.FileSource
	Guard    Guard

	// WriteBudget caps content-creating provider requests; zero means no limit.
	WriteBudget uint32
	Deadline    time.Time

	// RemoteState is Origin's cached listing for this branch, nil if there is none.
	RemoteState          *RemoteState
	RemoteStateKeyPrefix string
	Listings             ListingStore

	Tuning Tuning
}
