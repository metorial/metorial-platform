package commitbatch

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

const (
	DefaultInitialBytes int64 = 12 << 20
	DefaultMaxBytes     int64 = 24 << 20
	DefaultMinBytes     int64 = 1 << 20
	DefaultMaxChanges         = 1000

	// MaxInProcessWait is the longest the batcher sleeps for a rate limit; longer
	// waits end the invocation so the worker slot is released (Origin re-enqueues).
	MaxInProcessWait = 60 * time.Second

	defaultMaxRefreshes      = 5
	maxAttemptsPerBatch      = 6
	referenceOverheadBytes   = 128
	addOverheadBytes         = 64
	deleteOverheadBytes      = 32
	growthNumerator          = 5
	growthDenominator        = 4
	sizeReductionDenominator = 2
)

// Planner computes the change set against remote, whose CommitSHA is the branch head.
// It runs at the start and again whenever the remote state had to be re-read; since
// every change is derived from content, re-planning never repeats committed work.
type Planner func(ctx context.Context, remote *remotestate.Listing) (*Plan, error)

// Refresher re-reads the remote state at the branch's current head.
type Refresher func(ctx context.Context) (*remotestate.Listing, error)

type Options struct {
	Writer CommitWriter
	// Remote is the listing at the branch head (Remote.CommitSHA). It is updated in
	// place as batches commit.
	Remote  *remotestate.Listing
	Plan    Planner
	Refresh Refresher
	LFS     LFSUploader
	Message string
	// ForceLFS is asked about an add the provider rejects as too large on its own. If
	// it returns true, the caller plans that path as Git LFS from now on and the run
	// re-plans; otherwise the run fails with a BodyTooLargeError.
	ForceLFS func(change Change) bool

	// WriteBudget caps content-creating requests; zero means unlimited.
	WriteBudget int
	Deadline    time.Time

	MaxWait      time.Duration
	MaxRefreshes int
	Now          func() time.Time
	Sleep        func(ctx context.Context, d time.Duration) error
	Logf         func(format string, args ...any)
}

type Outcome struct {
	Head   string
	Remote *remotestate.Listing
	// StartHead is the head the run started from and LastCommit the last commit it
	// created (empty if none). ForeignHead is set once the head moved to a commit the
	// run didn't create, so the commits after that sit on top of someone else's.
	StartHead   string
	LastCommit  string
	ForeignHead bool
	// RemoteVerified is false once the locally maintained listing can no longer be
	// trusted to equal the remote tree (a reported tree SHA differed, or a change
	// couldn't be applied). Callers must not cache an unverified listing.
	RemoteVerified bool
	// Plan is the most recent plan.
	Plan *Plan

	Commits             int
	Writes              int
	Partial             bool
	RetryAfter          time.Time
	FilesWritten        int
	References          int
	Deletes             int
	BytesWritten        int64
	LFSUploaded         int
	BatchSizeReductions int
	RateLimitWait       time.Duration
	Refreshes           int
}

func (o *Outcome) NoChanges() bool {
	return o.Commits == 0 && !o.Partial && (o.Plan == nil || o.Plan.Empty())
}

type runner struct {
	opts   Options
	limits BatchLimits
	out    *Outcome
	queue  *queue
	size   int64
	// changeCap bounds the changes per batch below limits.MaxChanges after rejections,
	// so a batch of many small changes keeps shrinking once size is at MinBytes.
	changeCap int
}

// Run commits the plan as a sequence of batches, adapting the batch size to what the
// provider accepts. The Outcome is returned with errors too, so callers can report
// commits created before the failure. Every batch is a real commit on the branch, so a
// later invocation resumes by planning against the new head.
func Run(ctx context.Context, opts Options) (*Outcome, error) {
	if opts.Writer == nil || opts.Remote == nil || opts.Plan == nil {
		return nil, errors.New("commitbatch: Writer, Remote and Plan are required")
	}
	if opts.MaxWait <= 0 || opts.MaxWait > MaxInProcessWait {
		opts.MaxWait = MaxInProcessWait
	}
	if opts.MaxRefreshes <= 0 {
		opts.MaxRefreshes = defaultMaxRefreshes
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	if opts.Sleep == nil {
		opts.Sleep = sleepContext
	}
	if opts.Logf == nil {
		opts.Logf = log.Printf
	}

	r := &runner{
		opts:   opts,
		limits: normalizeLimits(opts.Writer.Limits()),
		out:    &Outcome{Head: opts.Remote.CommitSHA, StartHead: opts.Remote.CommitSHA, Remote: opts.Remote, RemoteVerified: true},
	}
	r.size = r.limits.InitialBytes
	r.changeCap = r.limits.MaxChanges

	plan, err := opts.Plan(ctx, opts.Remote)
	if err != nil {
		return r.out, err
	}
	r.setPlan(plan)

	return r.out, r.loop(ctx)
}

func normalizeLimits(l BatchLimits) BatchLimits {
	if l.MinBytes <= 0 {
		l.MinBytes = DefaultMinBytes
	}
	if l.InitialBytes <= 0 {
		l.InitialBytes = DefaultInitialBytes
	}
	if l.MaxBytes <= 0 {
		l.MaxBytes = max(DefaultMaxBytes, l.InitialBytes)
	}
	l.InitialBytes = min(max(l.InitialBytes, l.MinBytes), l.MaxBytes)
	l.MinBytes = min(l.MinBytes, l.InitialBytes)
	if l.MaxChanges <= 0 {
		l.MaxChanges = DefaultMaxChanges
	}
	return l
}

func (r *runner) setPlan(plan *Plan) {
	if plan == nil {
		plan = &Plan{}
	}
	r.out.Plan = plan
	r.queue = newQueue(plan)
}

func (r *runner) loop(ctx context.Context) error {
	attempts := 0

	for !r.queue.done() {
		if err := ctx.Err(); err != nil {
			return err
		}
		if !r.opts.Deadline.IsZero() && !r.opts.Now().Before(r.opts.Deadline) {
			r.out.Partial = true
			return nil
		}

		changes, cost, fits := r.fitBudget(r.queue.next(r.size, r.batchLimits()))
		if !fits {
			r.out.Partial = true
			return nil
		}
		batch := Batch{Message: r.message(changes), Changes: changes}

		if err := r.uploadLFS(ctx, changes); err != nil {
			return err
		}

		attempts++
		newHead, treeSHA, err := r.commit(ctx, batch)
		r.out.Writes += cost

		var (
			ambiguous   *AmbiguousError
			rateLimited *RateLimitedError
		)

		switch {
		case err == nil:
			attempts = 0
			r.committed(changes, newHead, treeSHA)
			r.size = min(r.size*growthNumerator/growthDenominator, r.limits.MaxBytes)
			r.changeCap = min(r.changeCap*growthNumerator/growthDenominator+1, r.limits.MaxChanges)

		case errors.Is(err, ErrBodyTooLarge):
			if SingleUnit(changes) {
				target := changes[len(changes)-1]
				if target.Kind == ChangeAdd && target.LFS == nil && r.opts.ForceLFS != nil && r.opts.ForceLFS(target) {
					if err := r.replan(ctx); err != nil {
						return err
					}
					continue
				}
				return &BodyTooLargeError{Path: target.Path, Size: target.Size, Err: err}
			}
			r.shrink(changes)

		case errors.As(err, &ambiguous):
			if attempts >= maxAttemptsPerBatch {
				return err
			}
			if err := r.resolveAmbiguous(ctx, changes); err != nil {
				return err
			}

		case errors.Is(err, ErrHeadMismatch):
			if err := r.refresh(ctx); err != nil {
				return err
			}

		case errors.As(err, &rateLimited):
			if attempts >= maxAttemptsPerBatch || !r.waitForRateLimit(ctx, rateLimited.RetryAfter) {
				r.out.RetryAfter = rateLimited.RetryAfter
				return err
			}

		default:
			return err
		}
	}

	return nil
}

func (r *runner) cost(changes []Change) int {
	if costing, ok := r.opts.Writer.(CostingWriter); ok {
		return max(costing.Cost(Batch{Changes: changes}), 1)
	}
	return 1
}

// fitBudget trims a batch to the units the remaining write budget pays for. A single
// unit that costs more than the whole budget only runs as the invocation's first
// batch; it could never fit any budget, and the caller charges what was really used.
func (r *runner) fitBudget(changes []Change) ([]Change, int, bool) {
	cost := r.cost(changes)
	budget := r.opts.WriteBudget
	if budget <= 0 {
		return changes, cost, true
	}

	remaining := budget - r.out.Writes
	for cost > remaining && !SingleUnit(changes) {
		changes = dropLastUnit(changes)
		cost = r.cost(changes)
	}
	if cost > remaining && !(r.out.Writes == 0 && cost > budget) {
		return nil, 0, false
	}
	return changes, cost, true
}

func dropLastUnit(changes []Change) []Change {
	end := len(changes) - 1
	for end > 0 && changes[end-1].WithNext {
		end--
	}
	return changes[:end]
}

func (r *runner) commit(ctx context.Context, batch Batch) (string, string, error) {
	if treeWriter, ok := r.opts.Writer.(TreeReportingWriter); ok {
		return treeWriter.CommitWithTree(ctx, r.out.Head, batch)
	}

	newHead, err := r.opts.Writer.Commit(ctx, r.out.Head, batch)
	return newHead, "", err
}

func (r *runner) uploadLFS(ctx context.Context, changes []Change) error {
	var objects []LFSObject
	seen := map[string]bool{}
	for _, change := range changes {
		if change.LFS == nil || seen[change.LFS.OID] {
			continue
		}
		seen[change.LFS.OID] = true
		objects = append(objects, *change.LFS)
	}
	if len(objects) == 0 {
		return nil
	}
	if r.opts.LFS == nil {
		return errors.New("commitbatch: the plan contains Git LFS objects but no LFS uploader is configured")
	}

	uploaded, err := r.opts.LFS.UploadLFS(ctx, objects)
	r.out.LFSUploaded += uploaded
	return err
}

func (r *runner) committed(changes []Change, newHead, treeSHA string) {
	r.applyToRemote(changes, newHead, treeSHA)
	r.record(changes, newHead)
}

func (r *runner) record(changes []Change, newHead string) {
	r.queue.advance(len(changes))
	r.out.Commits++
	r.out.Head = newHead
	r.out.LastCommit = newHead

	for _, change := range changes {
		switch change.Kind {
		case ChangeAdd:
			r.out.FilesWritten++
			r.out.BytesWritten += change.Size
			if change.LFS != nil {
				r.out.BytesWritten += change.LFS.Size - change.Size
			}
		case ChangeReference:
			r.out.References++
		case ChangeDelete:
			r.out.Deletes++
		}
	}
}

func (r *runner) applyToRemote(changes []Change, newHead, treeSHA string) {
	remote := r.out.Remote
	remote.CommitSHA = newHead
	if !r.out.RemoteVerified {
		return
	}

	remoteChanges := make([]remotestate.Change, len(changes))
	for i, change := range changes {
		remoteChanges[i] = change.RemoteChange()
	}
	if err := remote.Apply(remoteChanges); err != nil {
		r.opts.Logf("[commitbatch] listing no longer matches the remote: %v", err)
		r.out.RemoteVerified = false
		return
	}
	if treeSHA != "" && remote.TreeSHA() != treeSHA {
		r.opts.Logf("[commitbatch] computed tree %s, provider reported %s; not caching the listing", remote.TreeSHA(), treeSHA)
		r.out.RemoteVerified = false
	}
}

func (r *runner) batchLimits() BatchLimits {
	limits := r.limits
	limits.MaxChanges = r.changeCap
	return limits
}

func (r *runner) shrink(changes []Change) {
	r.size = max(min(r.size, encodedBytes(changes))/sizeReductionDenominator, r.limits.MinBytes)
	r.changeCap = max(len(changes)/sizeReductionDenominator, 1)
	r.out.BatchSizeReductions++
}

// replan recomputes the remaining changes against the listing the run maintains,
// re-reading the remote first if that listing can't be trusted.
func (r *runner) replan(ctx context.Context) error {
	if !r.out.RemoteVerified {
		return r.refresh(ctx)
	}

	plan, err := r.opts.Plan(ctx, r.out.Remote)
	if err != nil {
		return err
	}
	r.setPlan(plan)
	return nil
}

// resolveAmbiguous handles a commit whose outcome is unknown: if the head didn't move,
// nothing landed and the batch is retried smaller; if the head's tree is exactly what
// the batch produces, it landed; otherwise someone else pushed and everything is
// re-planned from the new head.
func (r *runner) resolveAmbiguous(ctx context.Context, changes []Change) error {
	head, treeSHA, err := r.opts.Writer.Head(ctx)
	if err != nil {
		return err
	}

	if head == r.out.Head {
		r.shrink(changes)
		return nil
	}

	if r.out.RemoteVerified && treeSHA != "" {
		r.applyToRemote(changes, head, treeSHA)
		if r.out.RemoteVerified {
			r.record(changes, head)
			r.shrink(changes)
			return nil
		}
	}

	return r.refresh(ctx)
}

func (r *runner) refresh(ctx context.Context) error {
	if r.opts.Refresh == nil {
		return fmt.Errorf("%w and the remote state can't be refreshed", ErrHeadMismatch)
	}
	if r.out.Refreshes >= r.opts.MaxRefreshes {
		return fmt.Errorf("%w %d times during this export", ErrHeadMismatch, r.out.Refreshes)
	}
	r.out.Refreshes++

	remote, err := r.opts.Refresh(ctx)
	if err != nil {
		return err
	}
	if remote.CommitSHA != r.out.Head {
		r.out.ForeignHead = true
	}
	r.out.Remote, r.out.Head, r.out.RemoteVerified = remote, remote.CommitSHA, true

	plan, err := r.opts.Plan(ctx, remote)
	if err != nil {
		return err
	}
	r.setPlan(plan)
	return nil
}

func (r *runner) waitForRateLimit(ctx context.Context, retryAfter time.Time) bool {
	if retryAfter.IsZero() {
		return false
	}

	now := r.opts.Now()
	wait := retryAfter.Sub(now)
	if wait > r.opts.MaxWait {
		return false
	}
	if !r.opts.Deadline.IsZero() && now.Add(wait).After(r.opts.Deadline) {
		return false
	}
	if wait <= 0 {
		return true
	}

	if err := r.opts.Sleep(ctx, wait); err != nil {
		return false
	}
	r.out.RateLimitWait += wait
	return true
}

func (r *runner) message(changes []Change) string {
	committed := r.out.Commits
	remaining := r.queue.estimateBatches(r.size, r.batchLimits(), len(changes))
	total := committed + remaining
	if total <= 1 {
		return r.opts.Message
	}
	return fmt.Sprintf("%s (%d/%d)", r.opts.Message, committed+1, total)
}

func sleepContext(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// EncodedBytes estimates a change's share of the request body: base64 content plus
// path and JSON overhead.
func EncodedBytes(c Change) int64 {
	switch c.Kind {
	case ChangeAdd:
		return (c.Size+2)/3*4 + int64(len(c.Path)) + addOverheadBytes
	case ChangeReference:
		return int64(len(c.Path)) + referenceOverheadBytes
	default:
		return int64(len(c.Path)) + deleteOverheadBytes
	}
}

func encodedBytes(changes []Change) int64 {
	var total int64
	for _, c := range changes {
		total += EncodedBytes(c)
	}
	return total
}
