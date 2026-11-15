package export

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch/committest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest/manifesttest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

type memListingStore struct {
	mu      sync.Mutex
	objects map[string][]byte
	saves   int
	loads   int
}

func newMemListingStore() *memListingStore {
	return &memListingStore{objects: map[string][]byte{}}
}

func (s *memListingStore) Load(ctx context.Context, ref RemoteState) (*remotestate.Listing, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.loads++
	data, ok := s.objects[ref.ListingKey]
	if !ok {
		return nil, errors.New("listing not found")
	}
	listing, err := remotestate.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	if listing.TreeSHA() != ref.TreeSHA || listing.CommitSHA != ref.CommitSHA {
		return nil, fmt.Errorf("listing %s doesn't match", ref.ListingKey)
	}
	return listing, nil
}

func (s *memListingStore) Save(ctx context.Context, keyPrefix string, listing *remotestate.Listing) (*RemoteState, error) {
	var buf bytes.Buffer
	if err := remotestate.Encode(&buf, listing); err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.saves++
	key := remotestate.ObjectKey(keyPrefix, listing.TreeSHA())
	s.objects[key] = buf.Bytes()
	return &RemoteState{CommitSHA: listing.CommitSHA, TreeSHA: listing.TreeSHA(), ListingBucket: "origin", ListingKey: key, EntryCount: uint32(listing.Len())}, nil
}

type repoReader struct {
	repo  *committest.Repo
	reads int
	bases []string
}

func (r *repoReader) ReadRemote(ctx context.Context, commitSHA, treeSHA string, base *remotestate.Listing) (*remotestate.Listing, bool, error) {
	r.reads++
	if base != nil {
		r.bases = append(r.bases, base.CommitSHA)
	} else {
		r.bases = append(r.bases, "")
	}
	return r.repo.Listing(), true, nil
}

type syncFixture struct {
	*fixture
	repo     *committest.Repo
	reader   *repoReader
	listings *memListingStore
}

func newSyncFixture(t *testing.T, remote map[string][]byte) *syncFixture {
	repo := committest.NewRepo(remote)
	repo.SetLimits(commitbatch.BatchLimits{InitialBytes: 256 << 10, MaxBytes: 256 << 10, MinBytes: 16 << 10, SupportsReferences: true})
	return &syncFixture{fixture: newFixture(t), repo: repo, reader: &repoReader{repo: repo}, listings: newMemListingStore()}
}

func (f *syncFixture) input(files map[string][]byte, state *RemoteState) SyncInput {
	m := f.manifest(files)
	return SyncInput{
		Options: ManifestOptions{
			Manifest:             m,
			Source:               m.Source(f.storage),
			Guard:                Guard{AllowMassDelete: true},
			RemoteState:          state,
			RemoteStateKeyPrefix: "remote-state/repo/",
			Listings:             f.listings,
		},
		Writer:        f.repo,
		Remote:        f.reader,
		CommitMessage: "Sync skills",
		Logf:          f.t.Logf,
	}
}

func largeFiles(n, size int) map[string][]byte {
	files := map[string][]byte{}
	for i := 0; i < n; i++ {
		content := bytes.Repeat([]byte{byte(i)}, size)
		content = append(content, []byte(fmt.Sprint(i))...)
		files[fmt.Sprintf("plugins/p%02d/asset.bin", i)] = content
	}
	return files
}

func TestSyncCachesTheListingAndSkipsReadsWhenWarm(t *testing.T) {
	f := newSyncFixture(t, map[string][]byte{"README.md": []byte("user")})
	files := skillFiles(200)

	first, err := Sync(context.Background(), f.input(files, nil))
	if err != nil {
		t.Fatal(err)
	}
	head, tree, _ := f.repo.Head(context.Background())
	if first.CommitsCreated != 1 || first.NewRemoteState == nil || first.NewRemoteState.TreeSHA != tree || first.NewRemoteState.CommitSHA != head {
		t.Fatalf("first = %+v", first)
	}
	if f.reader.reads != 1 || first.Stats.FilesUploaded != 200 {
		t.Fatalf("reads=%d stats=%+v", f.reader.reads, first.Stats)
	}

	second, err := Sync(context.Background(), f.input(files, first.NewRemoteState))
	if err != nil {
		t.Fatal(err)
	}
	if second.CommitsCreated != 0 || second.NewRemoteState != nil || f.reader.reads != 1 || second.Stats.FilesSkipped != 200 {
		t.Fatalf("second = %+v reads=%d", second, f.reader.reads)
	}
	if f.storage.opens() != 200 {
		t.Fatalf("content opens = %d, want 200 (first run only)", f.storage.opens())
	}
}

func TestSyncStaleCacheReadsIncrementally(t *testing.T) {
	f := newSyncFixture(t, nil)
	files := skillFiles(20)

	first, err := Sync(context.Background(), f.input(files, nil))
	if err != nil {
		t.Fatal(err)
	}

	f.repo.Push(map[string][]byte{"README.md": []byte("someone edited the readme")})

	second, err := Sync(context.Background(), f.input(files, first.NewRemoteState))
	if err != nil {
		t.Fatal(err)
	}
	if f.reader.reads != 2 || f.reader.bases[1] != first.NewRemoteState.CommitSHA {
		t.Fatalf("reads=%d bases=%v", f.reader.reads, f.reader.bases)
	}
	if second.CommitsCreated != 0 || second.NewRemoteState == nil {
		t.Fatalf("second = %+v", second)
	}
}

func TestSyncSameTreeNewCommitRefreshesTheCacheRow(t *testing.T) {
	f := newSyncFixture(t, nil)
	files := skillFiles(5)

	first, err := Sync(context.Background(), f.input(files, nil))
	if err != nil {
		t.Fatal(err)
	}
	f.repo.Push(map[string][]byte{"README.md": []byte("x")})
	f.repo.Push(nil, "README.md")

	second, err := Sync(context.Background(), f.input(files, first.NewRemoteState))
	if err != nil {
		t.Fatal(err)
	}
	head, _, _ := f.repo.Head(context.Background())
	if f.reader.reads != 1 || second.NewRemoteState == nil || second.NewRemoteState.CommitSHA != head {
		t.Fatalf("reads=%d state=%+v", f.reader.reads, second.NewRemoteState)
	}
}

func TestSyncFailureCarriesProgress(t *testing.T) {
	f := newSyncFixture(t, nil)
	retryAt := time.Now().Add(time.Hour).Truncate(time.Second)
	f.repo.Before = func(attempt int, batch commitbatch.Batch) error {
		if attempt == 3 {
			return &commitbatch.RateLimitedError{RetryAfter: retryAt, Err: errors.New("secondary rate limit")}
		}
		return nil
	}

	_, err := Sync(context.Background(), f.input(largeFiles(12, 64<<10), nil))
	exportErr, ok := As(err)
	if !ok || exportErr.Code != CodeRateLimited {
		t.Fatalf("expected rate_limited, got %v", err)
	}
	if exportErr.Progress.CommitsCreated != 2 || !exportErr.Progress.RetryAfter.Equal(retryAt) || exportErr.Progress.Stats.CommitsCreated != 2 {
		t.Fatalf("progress = %+v", exportErr.Progress)
	}
	if exportErr.Progress.NewRemoteState == nil {
		t.Fatal("the listing after the committed batches should be cached")
	}
}

func TestSyncWriteBudgetIsPartial(t *testing.T) {
	f := newSyncFixture(t, nil)
	in := f.input(largeFiles(12, 64<<10), nil)
	in.Options.WriteBudget = 1

	result, err := Sync(context.Background(), in)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Partial || result.CommitsCreated != 1 || f.repo.Attempts != 1 {
		t.Fatalf("result = %+v attempts=%d", result, f.repo.Attempts)
	}
}

func TestSyncGuardFailsBeforeWriting(t *testing.T) {
	remote := skillFiles(50)
	f := newSyncFixture(t, remote)
	in := f.input(map[string][]byte{"plugins/new/SKILL.md": []byte("only")}, nil)
	in.Options.Guard = Guard{MaxUnexpectedDeletes: 5, MaxUnexpectedDeleteRatio: 0.1}

	_, err := Sync(context.Background(), in)
	if exportErr, ok := As(err); !ok || exportErr.Code != CodeDeletionGuardTripped {
		t.Fatalf("expected deletion_guard_tripped, got %v", err)
	}
	if f.repo.Attempts != 0 {
		t.Fatalf("attempts = %d", f.repo.Attempts)
	}
}

func TestSyncBranchMissing(t *testing.T) {
	f := newSyncFixture(t, nil)
	in := f.input(skillFiles(1), nil)
	in.Writer = missingBranch{f.repo}

	_, err := Sync(context.Background(), in)
	if exportErr, ok := As(err); !ok || exportErr.Code != CodeBranchMissing {
		t.Fatalf("expected branch_missing, got %v", err)
	}
}

type missingBranch struct{ *committest.Repo }

func (missingBranch) Head(context.Context) (string, string, error) {
	return "", "", commitbatch.ErrBranchMissing
}

func TestSyncSourceNotFoundNamesASampleOfTheMissingKeys(t *testing.T) {
	f := newSyncFixture(t, nil)
	files := map[string][]byte{
		"plugins/a/SKILL.md": []byte("a"),
		"plugins/b/SKILL.md": []byte("b"),
		"plugins/c/SKILL.md": []byte("c"),
	}
	in := f.input(files, nil)
	missing := map[string]bool{}
	for _, p := range []string{"plugins/a/SKILL.md", "plugins/c/SKILL.md"} {
		key := manifesttest.EntryFor(p, files[p]).Key
		f.storage.Delete(manifesttest.SourceBucket, key)
		missing[key] = true
	}

	_, err := Sync(context.Background(), in)
	exportErr, ok := As(err)
	if !ok || exportErr.Code != CodeSourceNotFound {
		t.Fatalf("expected source_not_found, got %v", err)
	}
	if len(exportErr.Details.Keys) != 2 || !missing[exportErr.Details.Keys[0]] || !missing[exportErr.Details.Keys[1]] {
		t.Fatalf("keys = %v, want both missing keys", exportErr.Details.Keys)
	}
	if len(exportErr.Details.Paths) != 2 {
		t.Fatalf("paths = %v", exportErr.Details.Paths)
	}
	if len(f.repo.Commits()) != 0 {
		t.Fatal("nothing should be committed while sources are missing")
	}
}

func TestSyncSourceNotFoundSampleIsBounded(t *testing.T) {
	f := newSyncFixture(t, nil)
	files := map[string][]byte{}
	for i := 0; i < maxSamples+15; i++ {
		files[fmt.Sprintf("plugins/p%02d/SKILL.md", i)] = []byte(fmt.Sprintf("skill %d", i))
	}
	in := f.input(files, nil)
	for p, content := range files {
		f.storage.Delete(manifesttest.SourceBucket, manifesttest.EntryFor(p, content).Key)
	}

	_, err := Sync(context.Background(), in)
	exportErr, ok := As(err)
	if !ok || exportErr.Code != CodeSourceNotFound {
		t.Fatalf("expected source_not_found, got %v", err)
	}
	if len(exportErr.Details.Keys) != maxSamples {
		t.Fatalf("got %d keys, want the %d-key sample", len(exportErr.Details.Keys), maxSamples)
	}
	seen := map[string]bool{}
	for _, key := range exportErr.Details.Keys {
		if seen[key] {
			t.Fatalf("duplicate key %s", key)
		}
		seen[key] = true
	}
}
