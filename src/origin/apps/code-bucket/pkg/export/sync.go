package export

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

// RemoteReader lists the remote tree at a commit. base is the most recent listing known
// for the branch (its CommitSHA can be offered as a "have"), or nil. complete is false
// when the listing deliberately left out subtrees; such listings are used for the diff
// but never cached.
type RemoteReader interface {
	ReadRemote(ctx context.Context, commitSHA, treeSHA string, base *remotestate.Listing) (listing *remotestate.Listing, complete bool, err error)
}

type RemoteReaderFunc func(ctx context.Context, commitSHA, treeSHA string, base *remotestate.Listing) (*remotestate.Listing, bool, error)

func (f RemoteReaderFunc) ReadRemote(ctx context.Context, commitSHA, treeSHA string, base *remotestate.Listing) (*remotestate.Listing, bool, error) {
	return f(ctx, commitSHA, treeSHA, base)
}

type SyncInput struct {
	Options       ManifestOptions
	Writer        commitbatch.CommitWriter
	Remote        RemoteReader
	LFS           commitbatch.LFSUploader
	CommitMessage string

	LFSThresholdBytes int64
	MaxFileBytes      int64
	MaxLFSFileBytes   int64
	ReadBlob          func(ctx context.Context, sha string) ([]byte, error)
	IsIndex           func(path string) bool

	// Requests reports provider API requests made so far (Stats.GithubRequests).
	Requests func() uint32
	Now      func() time.Time
	Sleep    func(ctx context.Context, d time.Duration) error
	Logf     func(format string, args ...any)
}

type syncRun struct {
	in SyncInput

	cached        *RemoteState
	cachedListing *remotestate.Listing
	complete      bool
	firstPlan     *Plan
	lastPlan      *Plan
	forcedLFS     map[string]bool
}

// maxMissingSourceProbes bounds the extra opens made after a missing source, so Origin
// can rebuild several missing objects in one recovery without reading the whole plan.
const maxMissingSourceProbes = 200

// Sync exports a manifest through a provider's CommitWriter: it learns the remote state
// (from Origin's cache when the head's tree is unchanged), plans the diff, commits it in
// batches and returns the updated remote state for the cache.
func Sync(ctx context.Context, in SyncInput) (*Result, error) {
	if in.Writer == nil || in.Remote == nil {
		return nil, errors.New("export: Writer and Remote are required")
	}
	if in.Logf == nil {
		in.Logf = log.Printf
	}
	if in.Now == nil {
		in.Now = time.Now
	}

	s := &syncRun{in: in, cached: in.Options.RemoteState}

	head, treeSHA, err := in.Writer.Head(ctx)
	if err != nil {
		return nil, FromError(err, s.progress(nil, nil))
	}

	remote, err := s.load(ctx, head, treeSHA)
	if err != nil {
		return nil, FromError(err, s.progress(nil, nil))
	}

	outcome, runErr := commitbatch.Run(ctx, commitbatch.Options{
		Writer:      in.Writer,
		Remote:      remote,
		Plan:        s.plan,
		Refresh:     s.refresh,
		LFS:         in.LFS,
		ForceLFS:    s.forceLFS,
		Message:     in.CommitMessage,
		WriteBudget: int(in.Options.WriteBudget),
		Deadline:    in.Options.Deadline,
		Now:         in.Now,
		Sleep:       in.Sleep,
		Logf:        in.Logf,
	})
	runErr = s.sampleMissingSources(ctx, runErr)

	if outcome == nil {
		return nil, runErr
	}

	newState := s.saveRemoteState(ctx, outcome)
	progress := s.progress(outcome, newState)

	if runErr != nil {
		return nil, FromError(runErr, progress)
	}

	return &Result{
		Stats:          progress.Stats,
		CommitsCreated: progress.CommitsCreated,
		Partial:        outcome.Partial,
		NewRemoteState: newState,
		RetryAfter:     outcome.RetryAfter,
		Lineage:        progress.Lineage,
		WriteRequests:  progress.WriteRequests,
	}, nil
}

func (s *syncRun) load(ctx context.Context, head, treeSHA string) (*remotestate.Listing, error) {
	if s.cached != nil && s.in.Options.Listings != nil {
		listing, err := s.in.Options.Listings.Load(ctx, *s.cached)
		if err != nil {
			s.in.Logf("[export] ignoring remote-state cache %s: %v", s.cached.ListingKey, err)
		} else {
			s.cachedListing = listing
			if s.cached.TreeSHA == treeSHA {
				listing.CommitSHA = head
				s.complete = true
				return listing, nil
			}
		}
	}

	return s.read(ctx, head, treeSHA, s.cachedListing)
}

func (s *syncRun) read(ctx context.Context, head, treeSHA string, base *remotestate.Listing) (*remotestate.Listing, error) {
	listing, complete, err := s.in.Remote.ReadRemote(ctx, head, treeSHA, base)
	if err != nil {
		return nil, err
	}
	if complete && listing.TreeSHA() != treeSHA {
		s.in.Logf("[export] remote listing for %s hashes to %s, expected tree %s; not caching it", head, listing.TreeSHA(), treeSHA)
		complete = false
	}

	listing.CommitSHA = head
	s.complete = complete
	return listing, nil
}

func (s *syncRun) refresh(ctx context.Context) (*remotestate.Listing, error) {
	head, treeSHA, err := s.in.Writer.Head(ctx)
	if err != nil {
		return nil, err
	}
	return s.read(ctx, head, treeSHA, s.cachedListing)
}

func (s *syncRun) plan(ctx context.Context, remote *remotestate.Listing) (*commitbatch.Plan, error) {
	opts := s.in.Options
	plan, err := PlanChanges(ctx, PlanInput{
		Manifest:           opts.Manifest,
		Previous:           opts.Previous,
		Source:             opts.Source,
		Remote:             remote,
		Guard:              opts.Guard,
		LFSThresholdBytes:  s.in.LFSThresholdBytes,
		MaxFileBytes:       s.in.MaxFileBytes,
		MaxLFSFileBytes:    s.in.MaxLFSFileBytes,
		ForceLFS:           s.forcedLFS,
		SupportsReferences: s.in.Writer.Limits().SupportsReferences,
		ReadBlob:           s.in.ReadBlob,
		IsIndex:            s.in.IsIndex,
	})
	if err != nil {
		return nil, err
	}
	if s.firstPlan == nil {
		s.firstPlan = plan
	}
	s.lastPlan = plan
	return &plan.Plan, nil
}

// sampleMissingSources turns a missing source into a source_not_found error that names a
// bounded sample of the other planned writes whose objects are missing too.
func (s *syncRun) sampleMissingSources(ctx context.Context, err error) error {
	var notFound *manifest.SourceNotFoundError
	if !errors.As(err, &notFound) || notFound.Key == "" {
		return err
	}

	details := Details{Path: notFound.Path, Key: notFound.Key, Keys: []string{notFound.Key}}
	if notFound.Path != "" {
		details.Paths = []string{notFound.Path}
	}

	if s.lastPlan != nil {
		seen := map[string]bool{notFound.Key: true}
		probes := 0
		for _, changes := range [][]commitbatch.Change{s.lastPlan.Content, s.lastPlan.Final} {
			for _, change := range changes {
				if len(details.Keys) >= maxSamples || probes >= maxMissingSourceProbes || ctx.Err() != nil {
					break
				}

				open := change.Open
				if change.LFS != nil {
					open = change.LFS.Open
				}
				if change.Kind != commitbatch.ChangeAdd || open == nil {
					continue
				}

				probes++
				body, openErr := open(ctx)
				if openErr == nil {
					body.Close()
					continue
				}

				var missing *manifest.SourceNotFoundError
				if errors.As(openErr, &missing) && missing.Key != "" && !seen[missing.Key] {
					seen[missing.Key] = true
					details.Keys = append(details.Keys, missing.Key)
					if missing.Path != "" {
						details.Paths = append(details.Paths, missing.Path)
					}
				}
			}
		}
	}

	return &Error{Code: CodeSourceNotFound, Message: notFound.Error(), Details: details, Err: err}
}

// forceLFS moves a file the provider rejects as too large to Git LFS, once, if LFS is
// on and the file may be a pointer (generated index files and .gitattributes may not).
func (s *syncRun) forceLFS(change commitbatch.Change) bool {
	isIndex := s.in.IsIndex
	if isIndex == nil {
		isIndex = DefaultIsIndex
	}
	maxLFS := s.in.MaxLFSFileBytes
	if maxLFS <= 0 {
		maxLFS = manifest.MaxFileBytes
	}

	switch {
	case s.in.LFS == nil || s.in.LFSThresholdBytes <= 0 || s.forcedLFS[change.Path]:
		return false
	case change.Path == GitattributesPath || isIndex(change.Path) || change.Size > maxLFS:
		return false
	}

	if s.forcedLFS == nil {
		s.forcedLFS = map[string]bool{}
	}
	s.forcedLFS[change.Path] = true
	s.in.Logf("[export] %s (%d bytes) is too large for a commit; storing it in Git LFS", change.Path, change.Size)
	return true
}

// saveRemoteState stores the listing the run ended on, unless it is the cached one or
// can't be trusted. Writers that don't report tree SHAs get one head read to verify.
func (s *syncRun) saveRemoteState(ctx context.Context, outcome *commitbatch.Outcome) *RemoteState {
	opts := s.in.Options
	listing := outcome.Remote
	if opts.Listings == nil || opts.RemoteStateKeyPrefix == "" || listing == nil || !s.complete || !outcome.RemoteVerified {
		return nil
	}

	treeSHA := listing.TreeSHA()
	if s.cached != nil && s.cached.CommitSHA == listing.CommitSHA && s.cached.TreeSHA == treeSHA {
		return nil
	}

	if _, reportsTree := s.in.Writer.(commitbatch.TreeReportingWriter); outcome.Commits > 0 && !reportsTree {
		head, headTree, err := s.in.Writer.Head(ctx)
		if err != nil || head != listing.CommitSHA || headTree != treeSHA {
			return nil
		}
	}

	state, err := opts.Listings.Save(ctx, opts.RemoteStateKeyPrefix, listing)
	if err != nil {
		s.in.Logf("[export] saving remote-state listing failed: %v", err)
		return nil
	}
	return state
}

func (s *syncRun) progress(outcome *commitbatch.Outcome, newState *RemoteState) Progress {
	var stats Stats
	if s.in.Options.Manifest != nil {
		stats.FilesTotal = uint32(s.in.Options.Manifest.Header.EntryCount)
	}
	if s.firstPlan != nil {
		stats.FilesSkipped = uint32(s.firstPlan.Skipped)
		stats.UnexpectedDeletes = uint32(len(s.firstPlan.UnexpectedDeletes))
	}
	if s.in.Requests != nil {
		stats.GithubRequests = s.in.Requests()
	}

	progress := Progress{NewRemoteState: newState}
	if outcome != nil {
		stats.FilesUploaded = uint32(outcome.FilesWritten)
		stats.BlobsCreated = uint32(outcome.FilesWritten)
		stats.BlobsReused = uint32(outcome.References)
		stats.LFSUploaded = uint32(outcome.LFSUploaded)
		stats.BytesUploaded = uint64(outcome.BytesWritten)
		stats.Deleted = uint32(outcome.Deletes)
		stats.CommitsCreated = uint32(outcome.Commits)
		stats.BatchSizeReductions = uint32(outcome.BatchSizeReductions)
		stats.RateLimitWaitMs = uint64(outcome.RateLimitWait / time.Millisecond)

		progress.CommitsCreated = uint32(outcome.Commits)
		progress.RetryAfter = outcome.RetryAfter
		progress.WriteRequests = uint32(outcome.Writes)
		progress.Lineage = Lineage{
			StartHeadSHA:   outcome.StartHead,
			LastCommitSHA:  outcome.LastCommit,
			ForeignCommits: outcome.ForeignHead,
		}
	}
	progress.Stats = stats
	return progress
}
