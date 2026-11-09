package commitbatch_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"path"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch/committest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

func isIndex(p string) bool { return path.Base(p) == "plugin.json" }

// desiredPlanner is a minimal stand-in for the export diff engine: it diffs a desired
// file set against the remote by blob SHA.
func desiredPlanner(desired map[string][]byte, opens *int) commitbatch.Planner {
	return func(ctx context.Context, remote *remotestate.Listing) (*commitbatch.Plan, error) {
		existing := map[string]bool{}
		_ = remote.Blobs(func(e remotestate.Entry) error {
			existing[e.SHA] = true
			return nil
		})

		paths := make([]string, 0, len(desired))
		for p := range desired {
			paths = append(paths, p)
		}
		sort.Strings(paths)

		plan := &commitbatch.Plan{}
		var index []commitbatch.Change
		uploaded := map[string]bool{}
		for _, p := range paths {
			content := desired[p]
			sha := committest.GitBlobSHA(content)
			if e, ok := remote.Lookup(p); ok && e.SHA == sha {
				continue
			}

			change := commitbatch.Change{Path: p, BlobSHA: sha}
			switch {
			case existing[sha] || uploaded[sha]:
				change.Kind = commitbatch.ChangeReference
			default:
				change.Kind = commitbatch.ChangeAdd
				change.Size = int64(len(content))
				change.Open = func(context.Context) (io.ReadCloser, error) {
					if opens != nil {
						*opens++
					}
					return io.NopCloser(bytes.NewReader(content)), nil
				}
			}

			switch {
			case isIndex(p):
				index = append(index, change)
			case change.Kind == commitbatch.ChangeReference:
				plan.References = append(plan.References, change)
			default:
				uploaded[sha] = true
				plan.Content = append(plan.Content, change)
			}
		}

		plan.Final = index
		_ = remote.Blobs(func(e remotestate.Entry) error {
			if _, ok := desired[e.Path]; !ok {
				plan.Final = append(plan.Final, commitbatch.Change{Kind: commitbatch.ChangeDelete, Path: e.Path})
			}
			return nil
		})
		return plan, nil
	}
}

type harness struct {
	repo    *committest.Repo
	desired map[string][]byte
	opts    commitbatch.Options
	sleeps  []time.Duration
	now     time.Time
}

func newHarness(t *testing.T, initial, desired map[string][]byte) *harness {
	t.Helper()

	h := &harness{repo: committest.NewRepo(initial), desired: desired, now: time.Unix(1_800_000_000, 0)}
	h.repo.SetLimits(commitbatch.BatchLimits{
		InitialBytes:       1 << 20,
		MaxBytes:           1 << 20,
		MinBytes:           64 << 10,
		MaxChanges:         1000,
		SupportsReferences: true,
	})
	h.opts = commitbatch.Options{
		Writer:  h.repo,
		Remote:  h.repo.Listing(),
		Plan:    desiredPlanner(desired, nil),
		Refresh: func(ctx context.Context) (*remotestate.Listing, error) { return h.repo.Listing(), nil },
		Message: "Sync",
		Now:     func() time.Time { return h.now },
		Sleep: func(ctx context.Context, d time.Duration) error {
			h.sleeps = append(h.sleeps, d)
			h.now = h.now.Add(d)
			return nil
		},
		Logf: t.Logf,
	}
	return h
}

func (h *harness) run(t *testing.T) (*commitbatch.Outcome, error) {
	t.Helper()
	h.opts.Remote = h.repo.Listing()
	return commitbatch.Run(context.Background(), h.opts)
}

func (h *harness) assertConverged(t *testing.T) {
	t.Helper()

	paths := h.repo.Paths()
	if len(paths) != len(h.desired) {
		t.Fatalf("repo has %d paths, want %d", len(paths), len(h.desired))
	}
	for p, want := range h.desired {
		got, ok := h.repo.Content(p)
		if !ok || !bytes.Equal(got, want) {
			t.Fatalf("%s: content differs", p)
		}
	}
}

func randomBytes(n int) []byte {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return b
}

func binaries(count, size int) map[string][]byte {
	files := map[string][]byte{}
	for i := 0; i < count; i++ {
		files[fmt.Sprintf("plugins/p%04d/asset.bin", i)] = randomBytes(size)
	}
	return files
}

func TestNoChangesMakesNoWrites(t *testing.T) {
	files := map[string][]byte{"plugins/a/x.md": []byte("x")}
	h := newHarness(t, files, files)

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	if !out.NoChanges() || out.Writes != 0 || h.repo.Attempts != 0 {
		t.Fatalf("expected no writes, got %+v attempts=%d", out, h.repo.Attempts)
	}
}

func TestOneChangeWithIndexIsOneCommit(t *testing.T) {
	initial := map[string][]byte{"plugins/a/x.md": []byte("x"), "plugins/a/plugin.json": []byte("{}")}
	desired := map[string][]byte{"plugins/a/x.md": []byte("y"), "plugins/a/plugin.json": []byte(`{"v":2}`)}
	h := newHarness(t, initial, desired)

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	if out.Commits != 1 || out.Writes != 1 {
		t.Fatalf("commits=%d writes=%d, want 1/1", out.Commits, out.Writes)
	}
	if msg := h.repo.Commits()[0].Message; msg != "Sync" {
		t.Fatalf("single batch must not be numbered, got %q", msg)
	}
	h.assertConverged(t)
}

func TestOrderingAndConsistency(t *testing.T) {
	initial := map[string][]byte{"plugins/old/x.md": []byte("old")}
	for i := 0; i < 20; i++ {
		initial[fmt.Sprintf("plugins/moved/%d.md", i)] = []byte(fmt.Sprintf("moved %d", i))
	}

	desired := binaries(300, 10<<10)
	shared := randomBytes(4 << 10)
	for i := 0; i < 50; i++ {
		desired[fmt.Sprintf("plugins/dup/%02d.bin", i)] = shared
	}
	for i := 0; i < 20; i++ {
		desired[fmt.Sprintf("plugins/renamed/%d.md", i)] = []byte(fmt.Sprintf("moved %d", i))
	}
	desired["plugins/p0000/plugin.json"] = []byte(`{"name":"p0"}`)
	desired["plugins/p0001/plugin.json"] = []byte(`{"name":"p1"}`)

	h := newHarness(t, initial, desired)
	h.repo.SetLimits(commitbatch.BatchLimits{InitialBytes: 512 << 10, MaxBytes: 512 << 10, MinBytes: 64 << 10, MaxChanges: 1000, SupportsReferences: true})

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)

	commits := h.repo.Commits()
	if len(commits) < 5 || out.Commits != len(commits) {
		t.Fatalf("expected several batches, got %d (outcome %d)", len(commits), out.Commits)
	}

	phase := 0
	for i, commit := range commits {
		if !strings.HasSuffix(commit.Message, fmt.Sprintf("(%d/%d)", i+1, len(commits))) && !strings.Contains(commit.Message, fmt.Sprintf("(%d/", i+1)) {
			t.Fatalf("commit %d message %q isn't numbered", i, commit.Message)
		}
		for _, change := range commit.Changes {
			var p int
			switch {
			case change.Kind == commitbatch.ChangeDelete:
				p = 3
			case isIndex(change.Path):
				p = 2
			case change.Kind == commitbatch.ChangeReference:
				p = 1
			}
			if p < phase {
				t.Fatalf("commit %d: %s %s after phase %d", i, change.Kind, change.Path, phase)
			}
			phase = p
		}
	}

	last := commits[len(commits)-1]
	for _, change := range last.Changes {
		if change.Kind == commitbatch.ChangeAdd && !isIndex(change.Path) {
			t.Fatalf("last batch should only hold references, index files and deletes, got add %s", change.Path)
		}
	}
	if out.References != 49+20 {
		t.Fatalf("references = %d, want 69", out.References)
	}
}

func TestBodyTooLargeHalvesAndCompletes(t *testing.T) {
	desired := binaries(64, 32<<10)
	h := newHarness(t, nil, desired)
	h.repo.BodyCap = 300 << 10

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)
	if out.BatchSizeReductions == 0 {
		t.Fatal("expected the batch size to be reduced")
	}
	for _, commit := range h.repo.Commits() {
		var encoded int64
		for _, c := range commit.Changes {
			encoded += commitbatch.EncodedBytes(c)
		}
		if encoded > h.repo.BodyCap {
			t.Fatalf("committed batch of %d bytes over the cap", encoded)
		}
	}
}

func TestSingleChangeOverTheCapFails(t *testing.T) {
	h := newHarness(t, nil, map[string][]byte{"plugins/a/big.bin": randomBytes(200 << 10)})
	h.repo.BodyCap = 100 << 10

	_, err := h.run(t)
	if !errors.Is(err, commitbatch.ErrBodyTooLarge) || !strings.Contains(err.Error(), "plugins/a/big.bin") {
		t.Fatalf("expected ErrBodyTooLarge naming the path, got %v", err)
	}
}

func TestTimeoutAfterLandingDoesNotWriteTwice(t *testing.T) {
	desired := binaries(30, 64<<10)
	h := newHarness(t, nil, desired)
	h.repo.LandThenFail = func(attempt int) bool { return attempt == 2 }

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)

	seen := map[string]bool{}
	for _, commit := range h.repo.Commits() {
		for _, c := range commit.Changes {
			if seen[c.Path] {
				t.Fatalf("%s written twice", c.Path)
			}
			seen[c.Path] = true
		}
	}
	if out.Commits != len(h.repo.Commits()) {
		t.Fatalf("outcome counts %d commits, repo has %d", out.Commits, len(h.repo.Commits()))
	}
	if out.Refreshes != 0 {
		t.Fatalf("landing should be confirmed from the head's tree, got %d refreshes", out.Refreshes)
	}
}

func TestTimeoutAfterLandingWithoutTreeReportRefreshes(t *testing.T) {
	desired := binaries(30, 64<<10)
	h := newHarness(t, nil, desired)
	h.repo.NoTreeReport = true
	h.repo.LandThenFail = func(attempt int) bool { return attempt == 2 }

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)
	if out.Refreshes != 1 {
		t.Fatalf("refreshes = %d, want 1", out.Refreshes)
	}
	total := 0
	for _, commit := range h.repo.Commits() {
		total += len(commit.Changes)
	}
	if total != len(desired) {
		t.Fatalf("wrote %d changes for %d files", total, len(desired))
	}
}

func TestTimeoutWithoutLandingRetriesSmaller(t *testing.T) {
	desired := binaries(30, 64<<10)
	h := newHarness(t, nil, desired)
	h.repo.Before = func(attempt int, batch commitbatch.Batch) error {
		if attempt == 1 {
			return &commitbatch.AmbiguousError{Err: errors.New("timeout")}
		}
		return nil
	}

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)
	if out.BatchSizeReductions != 1 {
		t.Fatalf("reductions = %d, want 1", out.BatchSizeReductions)
	}
}

func TestForeignPushIsRecomputed(t *testing.T) {
	desired := binaries(40, 64<<10)
	h := newHarness(t, nil, desired)
	h.repo.Before = func(attempt int, batch commitbatch.Batch) error {
		if attempt == 2 {
			h.repo.Push(map[string][]byte{"plugins/p0039/asset.bin": desired["plugins/p0039/asset.bin"]})
		}
		return nil
	}

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)
	if out.Refreshes != 1 {
		t.Fatalf("refreshes = %d, want 1", out.Refreshes)
	}
	for _, commit := range h.repo.Commits() {
		for _, c := range commit.Changes {
			if c.Path == "plugins/p0039/asset.bin" {
				t.Fatalf("%s was pushed by someone else and must not be rewritten", c.Path)
			}
		}
	}
}

func TestRateLimitShortWaitSleepsInProcess(t *testing.T) {
	desired := binaries(30, 64<<10)
	h := newHarness(t, nil, desired)
	h.repo.Before = func(attempt int, batch commitbatch.Batch) error {
		if attempt == 2 {
			return &commitbatch.RateLimitedError{RetryAfter: h.now.Add(30 * time.Second), Err: errors.New("secondary")}
		}
		return nil
	}

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)
	if len(h.sleeps) != 1 || h.sleeps[0] != 30*time.Second || out.RateLimitWait != 30*time.Second {
		t.Fatalf("sleeps = %v wait = %s", h.sleeps, out.RateLimitWait)
	}
}

func TestRateLimitLongWaitStopsWithRetryAfter(t *testing.T) {
	desired := binaries(30, 64<<10)
	h := newHarness(t, nil, desired)
	retryAt := h.now.Add(10 * time.Minute)
	h.repo.Before = func(attempt int, batch commitbatch.Batch) error {
		if attempt == 3 {
			return &commitbatch.RateLimitedError{RetryAfter: retryAt, Err: errors.New("secondary")}
		}
		return nil
	}

	out, err := h.run(t)
	var rateLimited *commitbatch.RateLimitedError
	if !errors.As(err, &rateLimited) {
		t.Fatalf("expected a rate limit error, got %v", err)
	}
	if out.Commits != 2 || !out.RetryAfter.Equal(retryAt) || len(h.sleeps) != 0 {
		t.Fatalf("commits=%d retryAfter=%s sleeps=%v", out.Commits, out.RetryAfter, h.sleeps)
	}

	h.repo.Before = nil
	committed := len(h.repo.Commits())
	h.opts.Plan = desiredPlanner(desired, nil)
	if _, err := h.run(t); err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)
	for _, commit := range h.repo.Commits()[committed:] {
		for _, prior := range h.repo.Commits()[:committed] {
			for _, c := range commit.Changes {
				for _, p := range prior.Changes {
					if c.Path == p.Path {
						t.Fatalf("%s rewritten after resuming", c.Path)
					}
				}
			}
		}
	}
}

func TestWriteBudgetStopsWithPartial(t *testing.T) {
	desired := binaries(60, 64<<10)
	h := newHarness(t, nil, desired)
	h.opts.WriteBudget = 3

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	if !out.Partial || out.Writes != 3 || h.repo.Attempts != 3 || out.Commits != 3 {
		t.Fatalf("partial=%v writes=%d attempts=%d commits=%d", out.Partial, out.Writes, h.repo.Attempts, out.Commits)
	}
}

type costlyRepo struct {
	*committest.Repo
}

func (costlyRepo) Cost(batch commitbatch.Batch) int { return 2 }

func TestWriteBudgetUsesWriterCosts(t *testing.T) {
	desired := binaries(60, 64<<10)
	h := newHarness(t, nil, desired)
	h.opts.Writer = costlyRepo{h.repo}
	h.opts.WriteBudget = 5

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	if !out.Partial || out.Writes != 4 || out.Commits != 2 {
		t.Fatalf("partial=%v writes=%d commits=%d", out.Partial, out.Writes, out.Commits)
	}
}

func TestDeadlineStopsWithPartial(t *testing.T) {
	desired := binaries(60, 64<<10)
	h := newHarness(t, nil, desired)
	h.opts.Deadline = h.now.Add(time.Minute)
	h.repo.Before = func(attempt int, batch commitbatch.Batch) error {
		h.now = h.now.Add(25 * time.Second)
		return nil
	}

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	if !out.Partial || out.Commits != 3 {
		t.Fatalf("partial=%v commits=%d", out.Partial, out.Commits)
	}
}

func TestOversizedFileGetsItsOwnBatch(t *testing.T) {
	desired := map[string][]byte{
		"plugins/a/1.md":  []byte("one"),
		"plugins/a/2.md":  []byte("two"),
		"plugins/a/big":   randomBytes(300 << 10),
		"plugins/a/3.md":  []byte("three"),
		"plugins/a/4.bin": randomBytes(10),
	}
	h := newHarness(t, nil, desired)
	limits := h.repo.Limits()
	limits.MaxInlineFileBytes = 200 << 10
	h.repo.SetLimits(limits)

	if _, err := h.run(t); err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)

	for _, commit := range h.repo.Commits() {
		for _, c := range commit.Changes {
			if c.Path == "plugins/a/big" && len(commit.Changes) != 1 {
				t.Fatalf("oversized file shares a batch with %d changes", len(commit.Changes)-1)
			}
		}
	}
}

type recordingLFS struct {
	repo     *committest.Repo
	uploads  []string
	commitAt []int
}

func (l *recordingLFS) UploadLFS(ctx context.Context, objects []commitbatch.LFSObject) (int, error) {
	for _, o := range objects {
		l.uploads = append(l.uploads, o.OID)
		l.commitAt = append(l.commitAt, len(l.repo.Commits()))
	}
	return len(objects), nil
}

func TestLFSObjectsUploadBeforeTheirPointerCommits(t *testing.T) {
	h := newHarness(t, nil, map[string][]byte{"plugins/a/x.md": []byte("x")})
	lfs := &recordingLFS{repo: h.repo}
	h.opts.LFS = lfs

	pointer := []byte("version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 5\n")
	h.opts.Plan = func(ctx context.Context, remote *remotestate.Listing) (*commitbatch.Plan, error) {
		if _, ok := remote.Lookup("plugins/a/big.bin"); ok {
			return &commitbatch.Plan{}, nil
		}
		return &commitbatch.Plan{Content: []commitbatch.Change{{
			Kind:    commitbatch.ChangeAdd,
			Path:    "plugins/a/big.bin",
			BlobSHA: committest.GitBlobSHA(pointer),
			Size:    int64(len(pointer)),
			Open:    func(context.Context) (io.ReadCloser, error) { return io.NopCloser(bytes.NewReader(pointer)), nil },
			LFS:     &commitbatch.LFSObject{OID: "abc", Size: 5},
		}}}, nil
	}

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	if len(lfs.uploads) != 1 || lfs.commitAt[0] != 0 || out.LFSUploaded != 1 {
		t.Fatalf("uploads=%v at=%v", lfs.uploads, lfs.commitAt)
	}
}

func TestBranchMissingStops(t *testing.T) {
	h := newHarness(t, nil, map[string][]byte{"plugins/a/x.md": []byte("x")})
	h.repo.Before = func(int, commitbatch.Batch) error { return commitbatch.ErrBranchMissing }

	if _, err := h.run(t); !errors.Is(err, commitbatch.ErrBranchMissing) {
		t.Fatalf("expected ErrBranchMissing, got %v", err)
	}
}

func TestBatchSizeGrowsAfterSuccess(t *testing.T) {
	desired := binaries(200, 16<<10)
	h := newHarness(t, nil, desired)
	h.repo.SetLimits(commitbatch.BatchLimits{InitialBytes: 128 << 10, MaxBytes: 1 << 20, MinBytes: 64 << 10, MaxChanges: 1000, SupportsReferences: true})

	if _, err := h.run(t); err != nil {
		t.Fatal(err)
	}
	commits := h.repo.Commits()
	if len(commits[1].Changes) <= len(commits[0].Changes) {
		t.Fatalf("second batch (%d) should be larger than the first (%d)", len(commits[1].Changes), len(commits[0].Changes))
	}
}

func TestBodyTooLargeBelowTheByteFloorHalvesByChangeCount(t *testing.T) {
	desired := binaries(64, 4<<10)
	h := newHarness(t, nil, desired)
	h.repo.SetLimits(commitbatch.BatchLimits{InitialBytes: 1 << 20, MaxBytes: 1 << 20, MinBytes: 1 << 20, MaxChanges: 1000, SupportsReferences: true})
	h.repo.BodyCap = 40 << 10

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)
	if h.repo.Attempts > 64 {
		t.Fatalf("%d attempts for 64 files", h.repo.Attempts)
	}
	if out.BatchSizeReductions < 3 {
		t.Fatalf("batch size reductions = %d", out.BatchSizeReductions)
	}
}

func TestSingleChangeTooLargeAtAnySizeFails(t *testing.T) {
	for _, limits := range []commitbatch.BatchLimits{
		{InitialBytes: 1 << 20, MaxBytes: 1 << 20, MinBytes: 64 << 10},
		{InitialBytes: 4 << 20, MaxBytes: 4 << 20, MinBytes: 4 << 20},
	} {
		h := newHarness(t, nil, map[string][]byte{"plugins/a/big.bin": randomBytes(200 << 10), "plugins/a/small.md": []byte("# a")})
		limits.MaxChanges, limits.SupportsReferences = 1000, true
		h.repo.SetLimits(limits)
		h.repo.BodyCap = 100 << 10

		_, err := h.run(t)
		var tooLarge *commitbatch.BodyTooLargeError
		if !errors.As(err, &tooLarge) || tooLarge.Path != "plugins/a/big.bin" || tooLarge.Size != 200<<10 {
			t.Fatalf("limits %+v: got %v, want a BodyTooLargeError for big.bin", limits, err)
		}
		if h.repo.Attempts > 10 {
			t.Fatalf("%d attempts", h.repo.Attempts)
		}
	}
}

func TestSingleChangeTooLargeIsReplannedAsLFS(t *testing.T) {
	big := randomBytes(200 << 10)
	pointer := []byte("version https://git-lfs.github.com/spec/v1\noid sha256:x\nsize 204800\n")
	desired := map[string][]byte{"plugins/a/big.bin": big, "plugins/a/small.md": []byte("# a")}
	h := newHarness(t, nil, desired)
	h.repo.BodyCap = 100 << 10

	forced := map[string]bool{}
	var uploaded []commitbatch.LFSObject
	plan := desiredPlanner(desired, nil)
	h.opts.Plan = func(ctx context.Context, remote *remotestate.Listing) (*commitbatch.Plan, error) {
		if forced["plugins/a/big.bin"] {
			desired["plugins/a/big.bin"] = pointer
		}
		p, err := plan(ctx, remote)
		for i, c := range p.Content {
			if forced[c.Path] {
				p.Content[i].LFS = &commitbatch.LFSObject{OID: "x", Size: int64(len(big))}
			}
		}
		return p, err
	}
	h.opts.ForceLFS = func(c commitbatch.Change) bool {
		if forced[c.Path] {
			return false
		}
		forced[c.Path] = true
		return true
	}
	h.opts.LFS = lfsFunc(func(ctx context.Context, objects []commitbatch.LFSObject) (int, error) {
		uploaded = append(uploaded, objects...)
		return len(objects), nil
	})

	if _, err := h.run(t); err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)
	if len(uploaded) != 1 || uploaded[0].OID != "x" {
		t.Fatalf("uploaded %+v", uploaded)
	}
}

type lfsFunc func(ctx context.Context, objects []commitbatch.LFSObject) (int, error)

func (f lfsFunc) UploadLFS(ctx context.Context, objects []commitbatch.LFSObject) (int, error) {
	return f(ctx, objects)
}

func TestTiedChangesShareABatch(t *testing.T) {
	desired := binaries(40, 8<<10)
	desired["plugins/conflict/x.md"] = []byte("now a directory")
	h := newHarness(t, map[string][]byte{"plugins/conflict": []byte("was a file")}, desired)
	h.repo.BodyCap = 30 << 10

	plan := desiredPlanner(desired, nil)
	h.opts.Plan = func(ctx context.Context, remote *remotestate.Listing) (*commitbatch.Plan, error) {
		p, err := plan(ctx, remote)
		if err != nil {
			return nil, err
		}
		var final []commitbatch.Change
		for _, c := range p.Final {
			if c.Path != "plugins/conflict" {
				final = append(final, c)
			}
		}
		p.Final = final
		for i, c := range p.Content {
			if c.Path == "plugins/conflict/x.md" {
				tied := commitbatch.Change{Kind: commitbatch.ChangeDelete, Path: "plugins/conflict", WithNext: true}
				p.Content = append(p.Content[:i], append([]commitbatch.Change{tied}, p.Content[i:]...)...)
				break
			}
		}
		return p, nil
	}

	if _, err := h.run(t); err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)
	if len(h.repo.Commits()) < 5 {
		t.Fatalf("only %d commits; the test needs several batches", len(h.repo.Commits()))
	}
	for _, commit := range h.repo.Commits() {
		paths := map[string]bool{}
		for _, c := range commit.Changes {
			paths[c.Path] = true
		}
		if paths["plugins/conflict"] != paths["plugins/conflict/x.md"] {
			t.Fatalf("the delete and the add it clears the way for landed in different commits: %v", paths)
		}
	}
}

func TestSpanSegmentsCommitsEverythingAtOnce(t *testing.T) {
	initial := map[string][]byte{"plugins/old/SKILL.md": []byte("# old"), "plugins/a/LICENSE": []byte("MIT")}
	desired := merge(binaries(20, 8<<10), map[string][]byte{
		"plugins/a/LICENSE":                    []byte("MIT"),
		"plugins/b/LICENSE":                    []byte("MIT"),
		"plugins/a/.claude-plugin/plugin.json": []byte(`{"name":"a"}`),
	})
	h := newHarness(t, initial, desired)
	limits := h.repo.Limits()
	limits.SpanSegments = true
	h.repo.SetLimits(limits)

	out, err := h.run(t)
	if err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)
	if out.Commits != 1 || out.References != 1 || out.Deletes != 1 {
		t.Fatalf("commits %d, references %d, deletes %d; want everything in one commit", out.Commits, out.References, out.Deletes)
	}
	if msg := h.repo.Commits()[0].Message; msg != "Sync" {
		t.Fatalf("message %q", msg)
	}

	h = newHarness(t, initial, desired)
	limits.MaxBytes, limits.InitialBytes, limits.MinBytes = 64<<10, 64<<10, 64<<10
	h.repo.SetLimits(limits)
	if _, err := h.run(t); err != nil {
		t.Fatal(err)
	}
	h.assertConverged(t)
	commits := h.repo.Commits()
	last := commits[len(commits)-1]
	for _, c := range last.Changes {
		if c.Kind == commitbatch.ChangeDelete {
			return
		}
	}
	t.Fatalf("deletes didn't come last across %d commits", len(commits))
}

func merge(maps ...map[string][]byte) map[string][]byte {
	out := map[string][]byte{}
	for _, m := range maps {
		for k, v := range m {
			out[k] = v
		}
	}
	return out
}

type perChangeCostRepo struct {
	*committest.Repo
	fixed int
}

func (r perChangeCostRepo) Cost(batch commitbatch.Batch) int { return r.fixed + len(batch.Changes) }

func TestWriteBudgetSizesBatches(t *testing.T) {
	tests := []struct {
		name        string
		files       int
		fixed       int
		maxChanges  int
		budget      int
		wantWrites  int
		wantCommits int
		wantPartial bool
	}{
		{name: "first batch is trimmed to the budget", files: 20, budget: 5, wantWrites: 5, wantCommits: 1, wantPartial: true},
		{name: "fixed request costs count too", files: 20, fixed: 3, budget: 9, wantWrites: 9, wantCommits: 1, wantPartial: true},
		{name: "later batches use what is left", files: 20, maxChanges: 4, budget: 6, wantWrites: 6, wantCommits: 2, wantPartial: true},
		{name: "a budget that covers everything", files: 4, budget: 30, wantWrites: 4, wantCommits: 1},
		{name: "a unit costlier than the budget runs alone as the first batch", files: 3, fixed: 3, budget: 2, wantWrites: 4, wantCommits: 1, wantPartial: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newHarness(t, nil, binaries(tt.files, 1<<10))
			if tt.maxChanges > 0 {
				limits := h.repo.Limits()
				limits.MaxChanges = tt.maxChanges
				h.repo.SetLimits(limits)
			}
			h.opts.Writer = perChangeCostRepo{Repo: h.repo, fixed: tt.fixed}
			h.opts.WriteBudget = tt.budget

			out, err := h.run(t)
			if err != nil {
				t.Fatal(err)
			}
			if out.Writes != tt.wantWrites || out.Commits != tt.wantCommits || out.Partial != tt.wantPartial {
				t.Fatalf("writes=%d commits=%d partial=%v, want %d %d %v", out.Writes, out.Commits, out.Partial, tt.wantWrites, tt.wantCommits, tt.wantPartial)
			}
			if tt.budget >= tt.fixed+1 && out.Writes > tt.budget {
				t.Fatalf("writes %d exceed the budget %d", out.Writes, tt.budget)
			}
		})
	}
}

func TestOutcomeReportsCommitLineage(t *testing.T) {
	desired := binaries(40, 64<<10)

	tests := []struct {
		name        string
		initial     map[string][]byte
		foreignPush bool
		wantCommits bool
		wantForeign bool
	}{
		{name: "only its own commits", wantCommits: true},
		{name: "nothing to write", initial: desired},
		{name: "someone pushed during the run", foreignPush: true, wantCommits: true, wantForeign: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := newHarness(t, tt.initial, desired)
			start, _, _ := h.repo.Head(context.Background())
			if tt.foreignPush {
				h.repo.Before = func(attempt int, batch commitbatch.Batch) error {
					if attempt == 2 {
						h.repo.Push(map[string][]byte{"README.md": []byte("hello")})
					}
					return nil
				}
			}

			out, err := h.run(t)
			if err != nil {
				t.Fatal(err)
			}
			head, _, _ := h.repo.Head(context.Background())
			if out.StartHead != start {
				t.Fatalf("start head = %s, want %s", out.StartHead, start)
			}
			if out.ForeignHead != tt.wantForeign {
				t.Fatalf("foreign head = %v, want %v", out.ForeignHead, tt.wantForeign)
			}
			switch {
			case tt.wantCommits && out.LastCommit != head:
				t.Fatalf("last commit = %q, want the branch head %s", out.LastCommit, head)
			case !tt.wantCommits && out.LastCommit != "":
				t.Fatalf("last commit = %q, want none", out.LastCommit)
			}
		})
	}
}
