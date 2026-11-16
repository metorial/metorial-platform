package export

import (
	"errors"
	"fmt"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
)

type Stats struct {
	FilesTotal          uint32 `json:"filesTotal"`
	FilesUploaded       uint32 `json:"filesUploaded"`
	FilesSkipped        uint32 `json:"filesSkipped"`
	BlobsCreated        uint32 `json:"blobsCreated"`
	BlobsReused         uint32 `json:"blobsReused"`
	LFSUploaded         uint32 `json:"lfsUploaded"`
	BytesUploaded       uint64 `json:"bytesUploaded"`
	Deleted             uint32 `json:"deleted"`
	UnexpectedDeletes   uint32 `json:"unexpectedDeletes"`
	GithubRequests      uint32 `json:"githubRequests"`
	RateLimitWaitMs     uint64 `json:"rateLimitWaitMs"`
	CommitsCreated      uint32 `json:"commitsCreated"`
	BatchSizeReductions uint32 `json:"batchSizeReductions"`
}

// RemoteState points at a stored remotestate listing; Origin upserts it into
// ScmRepositoryRemoteState.
type RemoteState struct {
	CommitSHA     string `json:"commitSha"`
	TreeSHA       string `json:"treeSha"`
	ListingBucket string `json:"listingBucket"`
	ListingKey    string `json:"listingKey"`
	EntryCount    uint32 `json:"entryCount"`
}

// Lineage tells Origin whether the branch holds only commits it pushed: the head the
// invocation started from, the last commit it created (empty if none), and whether the
// head moved to someone else's commit while it ran.
type Lineage struct {
	StartHeadSHA   string `json:"startHeadSha,omitempty"`
	LastCommitSHA  string `json:"lastCommitSha,omitempty"`
	ForeignCommits bool   `json:"foreignCommits,omitempty"`
}

type Result struct {
	Stats          Stats
	CommitsCreated uint32
	// Partial means the slice deadline or write budget ended the run before all work
	// was done; Origin re-enqueues and the next run continues from the branch head.
	Partial        bool
	NewRemoteState *RemoteState
	RetryAfter     time.Time
	Lineage        Lineage
	// WriteRequests counts the content-creating requests charged against the write
	// budget, including failed attempts.
	WriteRequests uint32
}

// FromError maps errors from the manifest and commit layers onto structured export
// errors. Errors it doesn't recognize are returned unchanged so the legacy provider
// error mapping still applies to them.
func FromError(err error, progress Progress) error {
	if err == nil {
		return nil
	}

	if exportErr, ok := As(err); ok {
		if exportErr.Progress == (Progress{}) {
			exportErr.Progress = progress
		}
		return exportErr
	}

	var (
		invalid     *manifest.InvalidError
		notFound    *manifest.SourceNotFoundError
		mismatch    *manifest.ContentMismatchError
		rateLimited *commitbatch.RateLimitedError
		tooLarge    *commitbatch.BodyTooLargeError
	)

	switch {
	case errors.As(err, &invalid):
		return &Error{
			Code:     CodeManifestInvalid,
			Message:  invalid.Error(),
			Details:  Details{Line: invalid.Line, Path: invalid.Path, Reason: invalid.Reason, Key: invalid.Ref.Key},
			Progress: progress,
			Err:      err,
		}

	case errors.As(err, &notFound):
		details := Details{Path: notFound.Path, Key: notFound.Key}
		if notFound.Key != "" {
			details.Keys = []string{notFound.Key}
		}
		if notFound.Path != "" {
			details.Paths = []string{notFound.Path}
		}
		return &Error{Code: CodeSourceNotFound, Message: notFound.Error(), Details: details, Progress: progress, Err: err}

	case errors.As(err, &mismatch):
		return &Error{
			Code:     CodeContentMismatch,
			Message:  mismatch.Error(),
			Details:  Details{Path: mismatch.Path, Key: mismatch.Key, Reason: mismatch.Reason},
			Progress: progress,
			Err:      err,
		}

	case errors.As(err, &rateLimited):
		progress.RetryAfter = rateLimited.RetryAfter
		return &Error{Code: CodeRateLimited, Message: rateLimited.Error(), Progress: progress, Err: err}

	case errors.Is(err, commitbatch.ErrBranchMissing):
		return &Error{Code: CodeBranchMissing, Message: "branch not found", Progress: progress, Err: err}

	case errors.As(err, &tooLarge):
		return &Error{
			Code:     CodeFileTooLarge,
			Message:  fmt.Sprintf("%s: the provider rejected %s (%d bytes) as too large to commit", filelimit.ErrFileTooLarge, tooLarge.Path, tooLarge.Size),
			Details:  Details{Path: tooLarge.Path, Size: tooLarge.Size},
			Progress: progress,
			Err:      err,
		}

	case errors.Is(err, filelimit.ErrFileTooLarge), errors.Is(err, commitbatch.ErrBodyTooLarge):
		return &Error{Code: CodeFileTooLarge, Message: err.Error(), Progress: progress, Err: err}

	case errors.Is(err, gitlfs.ErrQuotaExceeded):
		return &Error{Code: CodeLFSQuotaExceeded, Message: err.Error(), Progress: progress, Err: err}
	}

	return err
}

// FileTooLarge keeps the legacy "file exceeds the per-file size limit" wording, which
// Origin's older error classification still keys on.
func FileTooLarge(path string, size, limit int64) *Error {
	return &Error{
		Code:    CodeFileTooLarge,
		Message: fmt.Sprintf("%s: %s is %d bytes, limit is %d bytes", filelimit.ErrFileTooLarge, path, size, limit),
		Details: Details{Path: path, Size: size, Limit: limit},
	}
}

// PathConflict reports a manifest path that a remote file or directory blocks and the
// export may not delete.
func PathConflict(manifestPath, remotePath, reason string) *Error {
	return &Error{
		Code:    CodePathConflict,
		Message: fmt.Sprintf("%s can't be written: %s %s", manifestPath, remotePath, reason),
		Details: Details{Path: manifestPath, Paths: []string{remotePath}, Reason: reason},
	}
}

func DeletionGuardTripped(paths []string, unexpected, scopeEntries int, guard Guard) *Error {
	return &Error{
		Code: CodeDeletionGuardTripped,
		Message: fmt.Sprintf(
			"refusing to delete %d unexpected paths out of %d in scope (limit %d and %.0f%%)",
			unexpected, scopeEntries, guard.MaxUnexpectedDeletes, guard.MaxUnexpectedDeleteRatio*100,
		),
		Details: Details{
			Paths:                    paths,
			Total:                    unexpected,
			UnexpectedDeletes:        unexpected,
			ScopeEntries:             scopeEntries,
			MaxUnexpectedDeletes:     guard.MaxUnexpectedDeletes,
			MaxUnexpectedDeleteRatio: guard.MaxUnexpectedDeleteRatio,
		},
	}
}
