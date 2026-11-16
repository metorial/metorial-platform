// Package commitbatch is the provider-agnostic contract for writing a change set to a
// branch as a sequence of commits. Providers implement CommitWriter; the batching
// algorithm (ordering, adaptive batch size, head re-reads, write budget) builds on it.
package commitbatch

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

type CommitWriter interface {
	Head(ctx context.Context) (commitSha, treeSha string, err error)
	Commit(ctx context.Context, base string, batch Batch) (newHead string, err error)
	Limits() BatchLimits // initial/max bytes and changes, per-file inline cap
}

// TreeReportingWriter is implemented by writers whose commit response already carries
// the new root tree SHA (GitHub's createCommitOnBranch), so the remote-state listing can
// be checked without another request.
type TreeReportingWriter interface {
	CommitWithTree(ctx context.Context, base string, batch Batch) (newHead, treeSha string, err error)
}

// CostingWriter reports how many content-creating requests committing batch takes
// (a REST tree/commit/ref batch is several); writers without it cost 1 per batch.
type CostingWriter interface {
	Cost(batch Batch) int
}

type ChangeKind int

const (
	// ChangeAdd writes content read through Open.
	ChangeAdd ChangeKind = iota + 1
	// ChangeReference points a path at a blob the remote already has; nothing is read.
	ChangeReference
	ChangeDelete
)

func (k ChangeKind) String() string {
	switch k {
	case ChangeAdd:
		return "add"
	case ChangeReference:
		return "reference"
	case ChangeDelete:
		return "delete"
	default:
		return fmt.Sprintf("ChangeKind(%d)", int(k))
	}
}

type Change struct {
	Kind ChangeKind
	Path string
	// Mode zero means remotestate.ModeFile.
	Mode remotestate.Mode
	// BlobSHA is the git blob SHA the path ends up with: the content's (or LFS
	// pointer's) SHA for adds, the existing blob for references. Empty for deletes.
	BlobSHA string
	// Size is the byte length Open yields; it is what counts against batch limits.
	Size int64
	Open func(ctx context.Context) (io.ReadCloser, error)
	// LFS is set when the add is a Git LFS pointer; the object is uploaded before the
	// batch that carries the pointer is committed.
	LFS *LFSObject
	// WithNext keeps this change in the same batch as the one after it, e.g. a delete
	// that clears a file out of the way of a directory the next add creates.
	WithNext bool
}

type LFSObject struct {
	OID  string
	Size int64
	Open func(ctx context.Context) (io.ReadCloser, error)
}

// LFSUploader stores objects on the provider's LFS server, skipping the ones it
// already has, and returns how many were transferred.
type LFSUploader interface {
	UploadLFS(ctx context.Context, objects []LFSObject) (uploaded int, err error)
}

// Plan is a change set in commit order. Content is written first, then references to
// blobs that exist by then, then Final: generated index files followed by deletions,
// so no intermediate commit points at content that isn't there yet.
type Plan struct {
	Content    []Change
	References []Change
	Final      []Change
}

func (p *Plan) Len() int { return len(p.Content) + len(p.References) + len(p.Final) }

func (p *Plan) Empty() bool { return p.Len() == 0 }

// RemoteChange is the listing update this change causes once its batch has committed.
func (c Change) RemoteChange() remotestate.Change {
	return remotestate.Change{Path: c.Path, Mode: c.Mode, SHA: c.BlobSHA, Delete: c.Kind == ChangeDelete}
}

type Batch struct {
	Message string
	Changes []Change
}

type BatchLimits struct {
	// InitialBytes, MaxBytes and MinBytes bound the encoded request body; the batcher
	// starts at InitialBytes, grows towards MaxBytes and halves down to MinBytes.
	InitialBytes int64
	MaxBytes     int64
	MinBytes     int64
	MaxChanges   int
	// MaxInlineFileBytes is the largest single file the writer accepts inside a
	// regular batch; larger files get a batch of their own.
	MaxInlineFileBytes int64
	// SupportsReferences reports whether Commit accepts ChangeReference changes.
	SupportsReferences bool
	// SpanSegments lets a batch mix content, references and final changes. Writers
	// whose commits are atomic snapshots (packfile pushes) set it, so a change set that
	// fits is written as one commit; the plan order still holds across batches.
	SpanSegments bool
}

var (
	// ErrHeadMismatch means the branch head was not base; nothing was written.
	ErrHeadMismatch = errors.New("commitbatch: branch head moved")
	// ErrBodyTooLarge means the provider rejected the request size; retry smaller.
	ErrBodyTooLarge = errors.New("commitbatch: request body too large")
	// ErrBranchMissing means the target branch does not exist.
	ErrBranchMissing = errors.New("commitbatch: branch not found")
	// ErrWriteBudgetExhausted ends an invocation with partial progress.
	ErrWriteBudgetExhausted = errors.New("commitbatch: write budget exhausted")
)

// BodyTooLargeError is a single change the provider rejects as too large even in a
// batch of its own.
type BodyTooLargeError struct {
	Path string
	Size int64
	Err  error
}

func (e *BodyTooLargeError) Error() string {
	return fmt.Sprintf("%s (%d bytes) is too large to commit: %v", e.Path, e.Size, e.Err)
}

func (e *BodyTooLargeError) Unwrap() error { return e.Err }

// AmbiguousError is returned when the provider didn't answer (timeout, dropped
// connection) and the commit may or may not have landed. The batcher re-reads Head.
type AmbiguousError struct {
	Err error
}

func (e *AmbiguousError) Error() string {
	return fmt.Sprintf("commitbatch: commit outcome unknown: %v", e.Err)
}

func (e *AmbiguousError) Unwrap() error { return e.Err }

// RateLimitedError carries the time the provider said to retry at (Retry-After,
// x-ratelimit-reset, RateLimit-Reset). RetryAfter is zero if the provider gave none.
type RateLimitedError struct {
	RetryAfter time.Time
	Err        error
}

func (e *RateLimitedError) Error() string {
	if e.RetryAfter.IsZero() {
		return fmt.Sprintf("rate limited by provider: %v", e.Err)
	}
	return fmt.Sprintf("rate limited by provider until %s: %v", e.RetryAfter.UTC().Format(time.RFC3339), e.Err)
}

func (e *RateLimitedError) Unwrap() error { return e.Err }
