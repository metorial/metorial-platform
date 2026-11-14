package github

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"runtime"
	"runtime/debug"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitremote"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest/manifesttest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

var marketplaceScope = manifest.Scope{
	Dirs:  []string{"plugins"},
	Files: []string{".claude-plugin/marketplace.json"},
}

type countingStorage struct {
	*manifesttest.Storage
	contentOpens atomic.Int32
}

func (s *countingStorage) OpenObject(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	if !strings.HasPrefix(key, manifest.KeyPrefix) {
		s.contentOpens.Add(1)
	}
	return s.Storage.OpenObject(ctx, bucket, key)
}

type memListingStore struct {
	mu      sync.Mutex
	objects map[string][]byte
	saves   int
}

func (s *memListingStore) Load(ctx context.Context, ref export.RemoteState) (*remotestate.Listing, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, ok := s.objects[ref.ListingKey]
	if !ok {
		return nil, errors.New("listing not found")
	}
	listing, err := remotestate.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	listing.CommitSHA = ref.CommitSHA
	return listing, nil
}

func (s *memListingStore) Save(ctx context.Context, keyPrefix string, listing *remotestate.Listing) (*export.RemoteState, error) {
	var buf bytes.Buffer
	if err := remotestate.Encode(&buf, listing); err != nil {
		return nil, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.saves++
	key := remotestate.ObjectKey(keyPrefix, listing.TreeSHA())
	s.objects[key] = buf.Bytes()
	return &export.RemoteState{CommitSHA: listing.CommitSHA, TreeSHA: listing.TreeSHA(), ListingBucket: "origin", ListingKey: key, EntryCount: uint32(listing.Len())}, nil
}

type fakeClock struct {
	mu    sync.Mutex
	now   time.Time
	slept time.Duration
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

func (c *fakeClock) Sleep(ctx context.Context, d time.Duration) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
	c.slept += d
	return ctx.Err()
}

type hubFixture struct {
	t        *testing.T
	hub      *fakeHub
	storage  *countingStorage
	listings *memListingStore
	clock    *fakeClock
	state    *export.RemoteState
}

func newHubFixture(t *testing.T, remote map[string][]byte) *hubFixture {
	return &hubFixture{
		t:        t,
		hub:      newFakeHub(t, remote),
		storage:  &countingStorage{Storage: manifesttest.NewStorage()},
		listings: &memListingStore{objects: map[string][]byte{}},
		clock:    &fakeClock{now: time.Now()},
	}
}

func (x *hubFixture) manifest(files map[string][]byte) *manifest.Manifest {
	x.t.Helper()

	entries := make([]manifest.Entry, 0, len(files))
	for p, content := range files {
		entries = append(entries, x.storage.PutContent(p, content))
	}
	return x.manifestFromEntries(entries)
}

func (x *hubFixture) manifestFromEntries(entries []manifest.Entry) *manifest.Manifest {
	x.t.Helper()

	data := manifesttest.Encode(manifest.Header{Scope: marketplaceScope}, entries)
	ref := x.storage.PutManifest("manifests", data)
	m, err := manifest.Open(context.Background(), x.storage, ref, manifest.Options{SpoolDir: x.t.TempDir()})
	if err != nil {
		x.t.Fatalf("open manifest: %v", err)
	}
	x.t.Cleanup(func() { m.Close() })
	return m
}

func (x *hubFixture) options(m *manifest.Manifest) ManifestExportOptions {
	opts := x.hub.options()
	opts.ManifestOptions = export.ManifestOptions{
		Manifest:             m,
		Source:               m.Source(x.storage),
		Guard:                export.Guard{AllowMassDelete: true},
		Deadline:             x.clock.Now().Add(time.Hour),
		RemoteState:          x.state,
		RemoteStateKeyPrefix: "remote-state/acme/",
		Listings:             x.listings,
	}
	opts.HTTPClient = x.hub.srv.Client()
	opts.TransferClient = x.hub.srv.Client()
	opts.Now = x.clock.Now
	opts.Sleep = x.clock.Sleep
	return opts
}

func (x *hubFixture) export(opts ManifestExportOptions) (*export.Result, error) {
	x.t.Helper()

	result, err := ExportManifest(context.Background(), opts)
	if result != nil && result.NewRemoteState != nil {
		x.state = result.NewRemoteState
	}
	if exportErr, ok := export.As(err); ok && exportErr.Progress.NewRemoteState != nil {
		x.state = exportErr.Progress.NewRemoteState
	}
	return result, err
}

func (x *hubFixture) sync(files map[string][]byte) *export.Result {
	x.t.Helper()

	result, err := x.export(x.options(x.manifest(files)))
	if err != nil {
		x.t.Fatalf("export: %v", err)
	}
	return result
}

func (x *hubFixture) assertFiles(want map[string][]byte) {
	x.t.Helper()

	got := x.hub.Files()
	for p, content := range want {
		if !bytes.Equal(got[p], content) {
			x.t.Errorf("%s: got %d bytes %.40q, want %d bytes %.40q", p, len(got[p]), got[p], len(content), content)
		}
	}
	for p := range got {
		if _, ok := want[p]; !ok {
			x.t.Errorf("unexpected remote file %s", p)
		}
	}
}

func assertCounts(t *testing.T, hub *fakeHub, want map[string]int) {
	t.Helper()

	got := hub.counts()
	for name, n := range want {
		if got[name] != n {
			t.Errorf("%s = %d, want %d (all counts %v)", name, got[name], n, got)
		}
	}
}

func skillFiles(n int) map[string][]byte {
	files := map[string][]byte{}
	for i := 0; i < n; i++ {
		files[fmt.Sprintf("plugins/p%03d/skills/s%d/SKILL.md", i%250, i)] = []byte(fmt.Sprintf("# skill %d\n", i))
	}
	return files
}

func binary(seed, size int) []byte {
	content := make([]byte, size)
	rand.New(rand.NewSource(int64(seed))).Read(content)
	content[0] = 0
	return content
}

func binaryFiles(n, size int) map[string][]byte {
	files := map[string][]byte{}
	for i := 0; i < n; i++ {
		files[fmt.Sprintf("plugins/p%02d/asset.bin", i)] = binary(i, size)
	}
	return files
}

func merged(maps ...map[string][]byte) map[string][]byte {
	out := map[string][]byte{}
	for _, m := range maps {
		for k, v := range m {
			out[k] = v
		}
	}
	return out
}

func exportCode(t *testing.T, err error) export.Code {
	t.Helper()

	exportErr, ok := export.As(err)
	if !ok {
		t.Fatalf("expected a structured export error, got %v", err)
	}
	return exportErr.Code
}

// nineBatches is nine files that each fill a 1 MiB batch on their own.
func nineBatches(x *hubFixture) (map[string][]byte, ManifestExportOptions) {
	files := binaryFiles(9, 700<<10)
	opts := x.options(x.manifest(files))
	opts.Tuning = export.Tuning{BatchInitialBytes: 1 << 20, BatchMaxBytes: 1 << 20}
	return files, opts
}

func TestManifestExportUnchangedManifestWritesNothing(t *testing.T) {
	files := skillFiles(5000)
	x := newHubFixture(t, files)

	result := x.sync(files)

	assertCounts(t, x.hub, map[string]int{"mutations": 0, "commits": 0, "blobPosts": 0, "treeBatches": 0, "lfsBatches": 0, "requests": 2})
	if opens := x.storage.contentOpens.Load(); opens != 0 {
		t.Errorf("opened %d content objects, want 0", opens)
	}
	if result.CommitsCreated != 0 || result.Stats.FilesSkipped != 5000 {
		t.Errorf("result = %+v", result)
	}
	if _, tree := x.hub.Head(); result.NewRemoteState == nil || result.NewRemoteState.TreeSHA != tree {
		t.Errorf("remote state %+v doesn't record tree %s", result.NewRemoteState, tree)
	}
}

func TestManifestExportOneChangeIsOneMutation(t *testing.T) {
	files := skillFiles(5000)
	x := newHubFixture(t, files)

	changed := merged(files, map[string][]byte{"plugins/p007/skills/s7/SKILL.md": []byte("# changed\n")})
	result := x.sync(changed)

	assertCounts(t, x.hub, map[string]int{"mutations": 1, "commits": 1, "blobPosts": 0, "treeBatches": 0})
	if opens := x.storage.contentOpens.Load(); opens != 1 {
		t.Errorf("opened %d content objects, want 1", opens)
	}
	if result.CommitsCreated != 1 || result.Stats.FilesUploaded != 1 || result.WriteRequests != 1 {
		t.Errorf("result = %+v, write requests %d", result.Stats, result.WriteRequests)
	}
	if head, _ := x.hub.Head(); result.Lineage.LastCommitSHA != head || result.Lineage.ForeignCommits {
		t.Errorf("lineage = %+v, want last commit %s and no foreign commits", result.Lineage, head)
	}
	x.assertFiles(changed)
}

func TestManifestExportDuplicatesUploadContentOnce(t *testing.T) {
	x := newHubFixture(t, map[string][]byte{"README.md": []byte("hi")})

	files := map[string][]byte{}
	for i := 0; i < 100; i++ {
		files[fmt.Sprintf("plugins/p%03d/LICENSE", i)] = []byte("MIT License\n")
	}
	result := x.sync(files)

	assertCounts(t, x.hub, map[string]int{"mutations": 1, "blobPosts": 0, "treeBatches": 1, "commits": 2})
	if opens := x.storage.contentOpens.Load(); opens != 1 {
		t.Errorf("opened %d content objects, want 1", opens)
	}
	if result.Stats.BlobsReused != 99 {
		t.Errorf("reused %d blobs, want 99", result.Stats.BlobsReused)
	}
	x.assertFiles(merged(files, map[string][]byte{"README.md": []byte("hi")}))
}

func TestManifestExportMovedDirectoryUploadsNothing(t *testing.T) {
	before := map[string][]byte{}
	after := map[string][]byte{}
	for i := 0; i < 50; i++ {
		content := binary(i, 2048)
		before[fmt.Sprintf("plugins/old-name/f%02d.bin", i)] = content
		after[fmt.Sprintf("plugins/new-name/f%02d.bin", i)] = content
	}
	x := newHubFixture(t, before)

	opts := x.options(x.manifest(after))
	opts.Previous = x.manifest(before)
	opts.Guard = export.Guard{}
	result, err := x.export(opts)
	if err != nil {
		t.Fatal(err)
	}

	assertCounts(t, x.hub, map[string]int{"mutations": 0, "blobPosts": 0, "treeBatches": 1, "commits": 1})
	if opens := x.storage.contentOpens.Load(); opens != 0 {
		t.Errorf("opened %d content objects, want 0", opens)
	}
	if result.Stats.Deleted != 50 || result.Stats.UnexpectedDeletes != 0 {
		t.Errorf("stats = %+v", result.Stats)
	}
	x.assertFiles(after)
}

func TestManifestExportRoutesFilesBySize(t *testing.T) {
	x := newHubFixture(t, map[string][]byte{".gitattributes": []byte("*.png binary\n")})

	small := []byte("# small\n")
	medium := binary(1, 100<<10)
	large := binary(2, 300<<10)
	files := map[string][]byte{
		"plugins/a/SKILL.md":   small,
		"plugins/a/medium.bin": medium,
		"plugins/a/large.bin":  large,
	}

	opts := x.options(x.manifest(files))
	opts.Tuning = export.Tuning{GraphQLMaxFileBytes: 64 << 10, RESTMaxBlobBytes: 256 << 10}
	if _, err := x.export(opts); err != nil {
		t.Fatal(err)
	}

	assertCounts(t, x.hub, map[string]int{"blobPosts": 1, "lfsPuts": 1, "lfsBatches": 1, "commits": 2})
	oid := gitlfs.OIDFor(large)
	if content, ok := x.hub.LFSObject(oid); !ok || !bytes.Equal(content, large) {
		t.Fatalf("LFS object %s missing", oid)
	}

	got := x.hub.Files()
	if !bytes.Equal(got["plugins/a/large.bin"], gitlfs.FormatPointer(oid, int64(len(large)))) {
		t.Errorf("large.bin is not an LFS pointer: %.60q", got["plugins/a/large.bin"])
	}
	if !bytes.Equal(got["plugins/a/medium.bin"], medium) || !bytes.Equal(got["plugins/a/SKILL.md"], small) {
		t.Error("small or medium file content differs")
	}
	attributes := string(got[".gitattributes"])
	if !strings.Contains(attributes, "*.png binary") || !strings.Contains(attributes, "plugins/a/large.bin filter=lfs diff=lfs merge=lfs -text") {
		t.Errorf(".gitattributes = %q", attributes)
	}

	x.hub.resetCounters()
	x.storage.contentOpens.Store(0)
	opts = x.options(x.manifest(files))
	opts.Tuning = export.Tuning{GraphQLMaxFileBytes: 64 << 10, RESTMaxBlobBytes: 256 << 10}
	if _, err := x.export(opts); err != nil {
		t.Fatal(err)
	}
	assertCounts(t, x.hub, map[string]int{"mutations": 0, "commits": 0, "lfsBatches": 0, "lfsPuts": 0, "blobPosts": 0})
	if opens := x.storage.contentOpens.Load(); opens != 0 {
		t.Errorf("unchanged LFS run opened %d content objects", opens)
	}
}

func TestManifestExportLFSThreshold(t *testing.T) {
	smallREST := export.Tuning{GraphQLMaxFileBytes: 64 << 10, RESTMaxBlobBytes: 256 << 10}

	tests := []struct {
		name      string
		threshold int64
		tuning    export.Tuning
		size      int
		wantLFS   bool
	}{
		{name: "no project threshold, file above the REST limit", tuning: smallREST, size: 300 << 10, wantLFS: true},
		{name: "negative project threshold, file above the REST limit", threshold: -1, tuning: smallREST, size: 300 << 10, wantLFS: true},
		{name: "no project threshold, file at the REST limit", tuning: smallREST, size: 256 << 10},
		{name: "no project threshold, file above the legacy default", size: int(DefaultLFSThresholdBytes) + 1<<20},
		{name: "project threshold below the REST limit", threshold: 100 << 10, tuning: smallREST, size: 150 << 10, wantLFS: true},
		{name: "project threshold above the REST limit", threshold: 10 << 20, tuning: smallREST, size: 300 << 10, wantLFS: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			x := newHubFixture(t, nil)
			content := binary(9, tt.size)
			opts := x.options(x.manifest(map[string][]byte{"plugins/a/file.bin": content}))
			opts.LFSThresholdBytes = tt.threshold
			opts.Tuning = tt.tuning
			if _, err := x.export(opts); err != nil {
				t.Fatal(err)
			}

			oid := gitlfs.OIDFor(content)
			got := x.hub.Files()["plugins/a/file.bin"]
			isPointer := bytes.Equal(got, gitlfs.FormatPointer(oid, int64(len(content))))
			if isPointer != tt.wantLFS {
				t.Fatalf("stored as LFS pointer = %v, want %v", isPointer, tt.wantLFS)
			}
			if !tt.wantLFS && !bytes.Equal(got, content) {
				t.Fatalf("content differs: %d bytes stored", len(got))
			}
		})
	}
}

func TestManifestExportGraphQLOnlyForSmallFiles(t *testing.T) {
	x := newHubFixture(t, nil)
	files := map[string][]byte{"plugins/a/SKILL.md": []byte("# a\n"), "plugins/a/icon.bin": binary(3, 10<<10)}

	x.sync(files)

	assertCounts(t, x.hub, map[string]int{"mutations": 1, "blobPosts": 0, "treeBatches": 0, "commits": 1})
	x.assertFiles(files)
}

func TestManifestExportFileLimits(t *testing.T) {
	tests := []struct {
		name   string
		size   int
		tune   func(*ManifestExportOptions)
		quota  bool
		expect export.Code
	}{
		{name: "over the LFS ceiling", size: 600 << 10, tune: func(o *ManifestExportOptions) { o.MaxLFSFileBytes = 512 << 10 }, expect: export.CodeFileTooLarge},
		{name: "over the file ceiling", size: 600 << 10, tune: func(o *ManifestExportOptions) { o.MaxFileBytes = 512 << 10 }, expect: export.CodeFileTooLarge},
		{name: "LFS quota", size: 600 << 10, quota: true, expect: export.CodeLFSQuotaExceeded},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			x := newHubFixture(t, nil)
			x.hub.lfsQuota = tc.quota

			opts := x.options(x.manifest(map[string][]byte{"plugins/a/huge.bin": binary(4, tc.size)}))
			opts.LFSThresholdBytes = 256 << 10
			if tc.tune != nil {
				tc.tune(&opts)
			}
			_, err := x.export(opts)
			if code := exportCode(t, err); code != tc.expect {
				t.Fatalf("code = %s, want %s (%v)", code, tc.expect, err)
			}
			assertCounts(t, x.hub, map[string]int{"commits": 0, "lfsPuts": 0})
		})
	}
}

func TestManifestExportScopeDeletes(t *testing.T) {
	x := newHubFixture(t, map[string][]byte{
		"README.md":              []byte("user content"),
		"docs/guide.md":          []byte("user docs"),
		"plugins/old/SKILL.md":   []byte("# stale"),
		"plugins/keep/SKILL.md":  []byte("# keep"),
		"plugins-extra/notes.md": []byte("outside the scope"),
	})

	files := map[string][]byte{"plugins/keep/SKILL.md": []byte("# keep")}
	result := x.sync(files)

	if result.Stats.Deleted != 1 {
		t.Errorf("deleted %d, want 1", result.Stats.Deleted)
	}
	x.assertFiles(merged(files, map[string][]byte{
		"README.md":              []byte("user content"),
		"docs/guide.md":          []byte("user docs"),
		"plugins-extra/notes.md": []byte("outside the scope"),
	}))
}

func TestManifestExportDeletionGuard(t *testing.T) {
	remote := map[string][]byte{"plugins/a/SKILL.md": []byte("# a"), "plugins/b/SKILL.md": []byte("# b"), "plugins/c/SKILL.md": []byte("# c")}

	tests := []struct {
		name    string
		guard   export.Guard
		tripped bool
	}{
		{name: "strict", guard: export.Guard{}, tripped: true},
		{name: "count allows", guard: export.Guard{MaxUnexpectedDeletes: 2}},
		{name: "ratio allows", guard: export.Guard{MaxUnexpectedDeleteRatio: 0.9}},
		{name: "ratio blocks", guard: export.Guard{MaxUnexpectedDeleteRatio: 0.5}, tripped: true},
		{name: "mass delete allowed", guard: export.Guard{AllowMassDelete: true}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			x := newHubFixture(t, remote)
			opts := x.options(x.manifest(map[string][]byte{"plugins/a/SKILL.md": []byte("# a")}))
			opts.Guard = tc.guard

			result, err := x.export(opts)
			if tc.tripped {
				if code := exportCode(t, err); code != export.CodeDeletionGuardTripped {
					t.Fatalf("code = %s", code)
				}
				assertCounts(t, x.hub, map[string]int{"mutations": 0, "commits": 0, "treeBatches": 0})
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if result.Stats.Deleted != 2 || result.Stats.UnexpectedDeletes != 2 {
				t.Errorf("stats = %+v", result.Stats)
			}
		})
	}
}

func TestManifestExportRejectsTamperedContent(t *testing.T) {
	x := newHubFixture(t, nil)
	files := map[string][]byte{"plugins/a/SKILL.md": []byte("# original\n")}
	m := x.manifest(files)
	entry := manifesttest.EntryFor("plugins/a/SKILL.md", files["plugins/a/SKILL.md"])
	x.storage.Put(manifesttest.SourceBucket, entry.Key, []byte("# tampered\n"))

	_, err := x.export(x.options(m))
	if code := exportCode(t, err); code != export.CodeContentMismatch {
		t.Fatalf("code = %s (%v)", code, err)
	}
	assertCounts(t, x.hub, map[string]int{"commits": 0})
}

func TestManifestExportBatchesManyBinariesInOrder(t *testing.T) {
	x := newHubFixture(t, nil)

	files := map[string][]byte{}
	for i := 0; i < 3000; i++ {
		files[fmt.Sprintf("plugins/p%02d/assets/a%04d.bin", i%40, i)] = binary(i, 4<<10)
	}
	files[".claude-plugin/marketplace.json"] = []byte(`{"plugins":[]}`)
	files["plugins/p00/.claude-plugin/plugin.json"] = []byte(`{"name":"p00"}`)

	result := x.sync(files)
	x.assertFiles(files)

	adds := x.hub.landedAdds
	if len(adds) < 3 || int(result.CommitsCreated) != len(adds) {
		t.Fatalf("%d mutations landed, %d commits reported", len(adds), result.CommitsCreated)
	}
	for i, batch := range adds {
		if len(batch) > 1000 {
			t.Errorf("batch %d has %d changes", i, len(batch))
		}
		for _, p := range batch {
			if export.DefaultIsIndex(p) && i != len(adds)-1 {
				t.Errorf("index file %s landed in batch %d of %d", p, i+1, len(adds))
			}
		}
	}
	last := adds[len(adds)-1]
	if !slices.Contains(last, ".claude-plugin/marketplace.json") || !slices.Contains(last, "plugins/p00/.claude-plugin/plugin.json") {
		t.Errorf("index files missing from the last batch")
	}
}

func TestManifestExportHalvesOnRequestTooLarge(t *testing.T) {
	x := newHubFixture(t, nil)
	x.hub.mutationBodyCap = 2 << 20

	files := binaryFiles(40, 100<<10)
	opts := x.options(x.manifest(files))
	opts.Tuning = export.Tuning{BatchInitialBytes: 6 << 20, BatchMaxBytes: 6 << 20}
	result, err := x.export(opts)
	if err != nil {
		t.Fatal(err)
	}

	if result.Stats.BatchSizeReductions < 2 {
		t.Errorf("batch size reductions = %d", result.Stats.BatchSizeReductions)
	}
	x.assertFiles(files)
}

func TestManifestExportSingleFileOverTheMutationCapUsesREST(t *testing.T) {
	x := newHubFixture(t, nil)
	x.hub.mutationBodyCap = 1 << 20

	files := map[string][]byte{"plugins/a/big.bin": binary(5, 900<<10)}
	x.sync(files)

	assertCounts(t, x.hub, map[string]int{"mutations": 1, "blobPosts": 1, "treeBatches": 1, "commits": 1})
	x.assertFiles(files)
}

func TestManifestExportFileRejectedAsTooLarge(t *testing.T) {
	t.Run("goes through LFS when enabled", func(t *testing.T) {
		x := newHubFixture(t, nil)
		x.hub.mutationBodyCap = 100 << 10
		x.hub.blobBodyCap = 100 << 10

		big := binary(7, 300<<10)
		files := map[string][]byte{"plugins/a/SKILL.md": []byte("# a"), "plugins/a/big.bin": big}
		opts := x.options(x.manifest(files))
		opts.LFSThresholdBytes = 10 << 20
		if _, err := x.export(opts); err != nil {
			t.Fatal(err)
		}

		oid := gitlfs.OIDFor(big)
		got := x.hub.Files()
		if !bytes.Equal(got["plugins/a/big.bin"], gitlfs.FormatPointer(oid, int64(len(big)))) {
			t.Fatalf("big.bin is not an LFS pointer: %.60q", got["plugins/a/big.bin"])
		}
		if content, ok := x.hub.LFSObject(oid); !ok || !bytes.Equal(content, big) {
			t.Fatalf("LFS object %s missing", oid)
		}
		if !strings.Contains(string(got[".gitattributes"]), "plugins/a/big.bin filter=lfs") {
			t.Fatalf(".gitattributes = %q", got[".gitattributes"])
		}
	})

	for _, tc := range []struct {
		name   string
		path   string
		maxLFS int64
	}{
		{name: "fails above the LFS object cap", path: "plugins/a/big.bin", maxLFS: 200 << 10},
		{name: "fails for index files", path: "plugins/a/plugin.json"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			x := newHubFixture(t, nil)
			x.hub.mutationBodyCap = 100 << 10
			x.hub.blobBodyCap = 100 << 10

			opts := x.options(x.manifest(map[string][]byte{tc.path: binary(7, 300<<10)}))
			opts.LFSThresholdBytes = 10 << 20
			opts.MaxLFSFileBytes = tc.maxLFS
			_, err := x.export(opts)

			exportErr, ok := export.As(err)
			if !ok || exportErr.Code != export.CodeFileTooLarge || exportErr.Details.Path != tc.path || exportErr.Details.Size != 300<<10 {
				t.Fatalf("expected file_too_large for %s, got %v", tc.path, err)
			}
		})
	}
}

func TestManifestExportTimeoutAfterLandingIsNotRepeated(t *testing.T) {
	x := newHubFixture(t, nil)
	x.hub.beforeMutation = func(n int) hubFault {
		if n == 2 {
			return faultDropAfterLanding
		}
		return faultNone
	}

	files, opts := nineBatches(x)
	result, err := x.export(opts)
	if err != nil {
		t.Fatal(err)
	}

	assertCounts(t, x.hub, map[string]int{"mutations": 9, "commits": 9})
	if result.CommitsCreated != 9 {
		t.Errorf("commits created = %d", result.CommitsCreated)
	}
	x.assertFiles(files)
	if _, tree := x.hub.Head(); result.NewRemoteState == nil || result.NewRemoteState.TreeSHA != tree {
		t.Errorf("remote state %+v, head tree %s", result.NewRemoteState, tree)
	}
}

func TestManifestExportBadGatewayRetriesSmaller(t *testing.T) {
	x := newHubFixture(t, nil)
	x.hub.beforeMutation = func(n int) hubFault {
		if n == 1 {
			return faultBadGateway
		}
		return faultNone
	}

	files := binaryFiles(20, 100<<10)
	opts := x.options(x.manifest(files))
	opts.Tuning = export.Tuning{BatchInitialBytes: 4 << 20, BatchMaxBytes: 4 << 20}
	result, err := x.export(opts)
	if err != nil {
		t.Fatal(err)
	}
	if result.Stats.BatchSizeReductions != 1 {
		t.Errorf("batch size reductions = %d", result.Stats.BatchSizeReductions)
	}
	x.assertFiles(files)
}

func TestManifestExportRecomputesAfterAForeignPush(t *testing.T) {
	x := newHubFixture(t, nil)
	x.hub.beforeMutation = func(n int) hubFault {
		if n == 3 {
			x.hub.Push(map[string][]byte{"plugins/p00/asset.bin": []byte("overwritten"), "NOTES.md": []byte("by hand")})
		}
		return faultNone
	}

	files, opts := nineBatches(x)
	start, _ := x.hub.Head()
	result, err := x.export(opts)
	if err != nil {
		t.Fatal(err)
	}

	x.assertFiles(merged(files, map[string][]byte{"NOTES.md": []byte("by hand")}))
	head, _ := x.hub.Head()
	if result.Lineage != (export.Lineage{StartHeadSHA: start, LastCommitSHA: head, ForeignCommits: true}) {
		t.Errorf("lineage = %+v, want start %s, last %s, foreign", result.Lineage, start, head)
	}
}

func TestManifestExportRateLimitStopsAndResumes(t *testing.T) {
	x := newHubFixture(t, nil)
	x.hub.beforeMutation = func(n int) hubFault {
		if n == 5 {
			return faultRateLimit
		}
		return faultNone
	}

	files, opts := nineBatches(x)
	_, err := x.export(opts)
	if code := exportCode(t, err); code != export.CodeRateLimited {
		t.Fatalf("code = %s (%v)", code, err)
	}
	progress := err.(*export.Error).Progress
	if progress.CommitsCreated != 4 || progress.NewRemoteState == nil {
		t.Fatalf("progress = %d commits, remote state %+v", progress.CommitsCreated, progress.NewRemoteState)
	}
	if wait := time.Until(progress.RetryAfter); wait < 59*time.Minute || wait > 61*time.Minute {
		t.Errorf("retry after %s, want the x-ratelimit-reset hour", progress.RetryAfter)
	}

	x.hub.beforeMutation = nil
	x.hub.resetCounters()
	_, opts = nineBatches(x)
	result, err := x.export(opts)
	if err != nil {
		t.Fatal(err)
	}

	assertCounts(t, x.hub, map[string]int{"mutations": 5, "commits": 5, "treeGets": 0})
	if result.Stats.FilesUploaded != 5 || result.Partial {
		t.Errorf("resume uploaded %d files (partial %v), want 5", result.Stats.FilesUploaded, result.Partial)
	}
	for _, batch := range x.hub.landedAdds {
		for _, p := range batch {
			if p < "plugins/p04" {
				t.Errorf("resume rewrote %s", p)
			}
		}
	}
	x.assertFiles(files)
}

func TestManifestExportShortRateLimitWaitsInProcess(t *testing.T) {
	x := newHubFixture(t, nil)
	x.hub.beforeMutation = func(n int) hubFault {
		if n == 3 {
			return faultShortRateLimit
		}
		return faultNone
	}

	files, opts := nineBatches(x)
	result, err := x.export(opts)
	if err != nil {
		t.Fatal(err)
	}
	if result.Partial || result.Stats.RateLimitWaitMs < 2000 {
		t.Errorf("partial %v, waited %d ms", result.Partial, result.Stats.RateLimitWaitMs)
	}
	x.assertFiles(files)
}

func TestManifestExportWriteBudget(t *testing.T) {
	x := newHubFixture(t, nil)
	_, opts := nineBatches(x)
	opts.WriteBudget = 3

	result, err := x.export(opts)
	if err != nil {
		t.Fatal(err)
	}
	assertCounts(t, x.hub, map[string]int{"mutations": 3, "commits": 3})
	if !result.Partial || result.CommitsCreated != 3 {
		t.Errorf("partial %v, commits %d", result.Partial, result.CommitsCreated)
	}
}

func TestManifestExportStopsAtTheSliceDeadline(t *testing.T) {
	x := newHubFixture(t, nil)
	x.hub.beforeMutation = func(int) hubFault {
		x.clock.Advance(time.Minute)
		return faultNone
	}

	_, opts := nineBatches(x)
	opts.Deadline = x.clock.Now().Add(150 * time.Second)
	result, err := x.export(opts)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Partial || result.CommitsCreated != 3 {
		t.Errorf("partial %v, commits %d", result.Partial, result.CommitsCreated)
	}
}

func TestManifestExportWarmCacheReadsOnlyTheBranch(t *testing.T) {
	files := skillFiles(500)
	x := newHubFixture(t, files)
	x.sync(files)

	x.hub.resetCounters()
	result := x.sync(files)

	assertCounts(t, x.hub, map[string]int{"requests": 1, "treeGets": 0})
	if result.NewRemoteState != nil {
		t.Errorf("unchanged run rewrote the remote state: %+v", result.NewRemoteState)
	}
}

func TestManifestExportUpdatesTheCacheWithoutReadingTheTree(t *testing.T) {
	files := skillFiles(500)
	x := newHubFixture(t, files)
	x.sync(files)

	x.hub.resetCounters()
	changed := merged(files, map[string][]byte{"plugins/p001/skills/s1/SKILL.md": []byte("# new\n")})
	result := x.sync(changed)

	head, tree := x.hub.Head()
	assertCounts(t, x.hub, map[string]int{"treeGets": 0, "mutations": 1})
	if result.NewRemoteState == nil || result.NewRemoteState.CommitSHA != head || result.NewRemoteState.TreeSHA != tree {
		t.Fatalf("remote state %+v, head %s tree %s", result.NewRemoteState, head, tree)
	}

	x.hub.resetCounters()
	x.sync(changed)
	assertCounts(t, x.hub, map[string]int{"requests": 1})
}

type fakeFetcher struct {
	hub   *fakeHub
	err   error
	calls int
	haves [][]string
	auth  string
}

func (f *fakeFetcher) FetchRemoteState(ctx context.Context, opts gitremote.FetchOptions) (*remotestate.Listing, string, string, error) {
	f.calls++
	f.haves = append(f.haves, opts.Have)
	f.auth = opts.AuthHeader
	if f.err != nil {
		return nil, "", "", f.err
	}

	head, tree := f.hub.Head()
	f.hub.mu.Lock()
	flat := f.hub.flatten(tree)
	f.hub.mu.Unlock()

	entries := make([]remotestate.Entry, 0, len(flat))
	for p, e := range flat {
		mode, err := remotestate.ParseMode(e.Mode)
		if err != nil {
			return nil, "", "", err
		}
		entries = append(entries, remotestate.Entry{Path: p, Mode: mode, SHA: e.SHA})
	}
	listing, err := remotestate.FromEntries(head, entries)
	return listing, head, tree, err
}

func TestManifestExportReadsTheRemoteWithTheFetcher(t *testing.T) {
	files := skillFiles(300)
	x := newHubFixture(t, files)
	fetcher := &fakeFetcher{hub: x.hub}

	opts := x.options(x.manifest(files))
	opts.Fetcher = fetcher
	if _, err := x.export(opts); err != nil {
		t.Fatal(err)
	}
	assertCounts(t, x.hub, map[string]int{"treeGets": 0, "requests": 1})
	if fetcher.auth != gitremote.BasicAuth("x-access-token", hubToken) {
		t.Errorf("auth header = %q", fetcher.auth)
	}

	cached, _ := x.hub.Head()
	x.hub.Push(map[string][]byte{"NOTES.md": []byte("hand edit")})
	opts = x.options(x.manifest(files))
	opts.Fetcher = fetcher
	if _, err := x.export(opts); err != nil {
		t.Fatal(err)
	}
	if last := fetcher.haves[len(fetcher.haves)-1]; len(last) != 1 || last[0] != cached {
		t.Errorf("incremental fetch offered %v, want the cached commit %s", last, cached)
	}
}

func TestManifestExportFallsBackToRESTWhenTheFetchIsRefused(t *testing.T) {
	files := skillFiles(300)
	x := newHubFixture(t, files)
	fetcher := &fakeFetcher{hub: x.hub, err: gitremote.ErrFilterUnsupported}

	opts := x.options(x.manifest(merged(files, map[string][]byte{"plugins/new/SKILL.md": []byte("# new")})))
	opts.Fetcher = fetcher
	result, err := x.export(opts)
	if err != nil {
		t.Fatal(err)
	}
	if fetcher.calls != 1 {
		t.Errorf("fetcher called %d times", fetcher.calls)
	}
	assertCounts(t, x.hub, map[string]int{"treeGets": 1, "mutations": 1})
	if result.NewRemoteState == nil {
		t.Error("REST listing wasn't cached")
	}
}

func TestManifestExportUsesRESTOnGitHubEnterpriseWithoutTheMutation(t *testing.T) {
	x := newHubFixture(t, map[string][]byte{"plugins/old/SKILL.md": []byte("# old")})
	x.hub.noGraphQL = true

	files := merged(binaryFiles(9, 700<<10), map[string][]byte{"plugins/a/SKILL.md": []byte("# a")})
	opts := x.options(x.manifest(files))
	opts.BaseURL = x.hub.srv.URL + "/api/v3"
	opts.Tuning = export.Tuning{BatchInitialBytes: 1 << 20, BatchMaxBytes: 1 << 20}
	result, err := x.export(opts)
	if err != nil {
		t.Fatal(err)
	}

	graphqlCalls := 0
	for _, line := range x.hub.log {
		if strings.HasSuffix(line, "/api/graphql") {
			graphqlCalls++
		}
	}
	if graphqlCalls != 1 {
		t.Errorf("tried GraphQL %d times, want once", graphqlCalls)
	}
	if got := x.hub.counts()["commits"]; got != int(result.CommitsCreated) || got < 9 {
		t.Errorf("commits = %d, reported %d", got, result.CommitsCreated)
	}
	x.assertFiles(files)
}

func TestManifestExportReplacesFilesAndDirectoriesOfTheOtherKind(t *testing.T) {
	for _, transport := range []string{"graphql", "rest"} {
		t.Run(transport, func(t *testing.T) {
			x := newHubFixture(t, map[string][]byte{
				"README.md":                   []byte("user content"),
				"plugins/a/skills":            []byte("a file where a directory goes"),
				"plugins/b/notes/one.md":      []byte("1"),
				"plugins/b/notes/deep/two.md": []byte("2"),
			})
			files := merged(binaryFiles(4, 700<<10), map[string][]byte{
				"plugins/a/skills/s/SKILL.md": []byte("# s"),
				"plugins/b/notes":             []byte("a file where a directory was"),
			})

			opts := x.options(x.manifest(files))
			opts.Tuning = export.Tuning{BatchInitialBytes: 1 << 20, BatchMaxBytes: 1 << 20}
			if transport == "rest" {
				x.hub.noGraphQL = true
				opts.BaseURL = x.hub.srv.URL + "/api/v3"
			}
			result, err := x.export(opts)
			if err != nil {
				t.Fatal(err)
			}

			if result.CommitsCreated < 4 || result.Stats.Deleted != 3 {
				t.Errorf("commits = %d, stats = %+v", result.CommitsCreated, result.Stats)
			}
			x.assertFiles(merged(files, map[string][]byte{"README.md": []byte("user content")}))
		})
	}
}

func TestManifestExportPathConflictOutsideTheScope(t *testing.T) {
	x := newHubFixture(t, map[string][]byte{".claude-plugin/marketplace.json/notes.md": []byte("user content")})

	_, err := x.export(x.options(x.manifest(map[string][]byte{".claude-plugin/marketplace.json": []byte("{}")})))
	if code := exportCode(t, err); code != export.CodePathConflict {
		t.Fatalf("code = %s", code)
	}
	if x.hub.counts()["commits"] != 0 {
		t.Fatal("committed despite the conflict")
	}
}

func TestManifestExportKeepsExecutableModes(t *testing.T) {
	x := newHubFixture(t, nil)
	x.hub.Push(map[string][]byte{"plugins/a/run.sh": []byte("#!/bin/sh\necho old\n")})
	x.hub.mu.Lock()
	flat := x.hub.flatten(x.hub.commits[x.hub.head].Tree)
	entry := flat["plugins/a/run.sh"]
	entry.Mode = "100755"
	flat["plugins/a/run.sh"] = entry
	x.hub.head = x.hub.putCommit(hubCommit{Tree: x.hub.writeTree(flat), Parent: x.hub.head, Message: "chmod"})
	x.hub.mu.Unlock()

	files := map[string][]byte{"plugins/a/run.sh": []byte("#!/bin/sh\necho new\n")}
	x.sync(files)

	x.assertFiles(files)
	if mode := x.hub.Mode("plugins/a/run.sh"); mode != "100755" {
		t.Errorf("mode = %s, want 100755", mode)
	}
}

func TestManifestExportRejectsNonRootTargets(t *testing.T) {
	x := newHubFixture(t, nil)
	for _, target := range []string{"", "/", "."} {
		opts := x.options(x.manifest(map[string][]byte{"plugins/a/SKILL.md": []byte("# a")}))
		opts.TargetPath = target
		if _, err := x.export(opts); err != nil {
			t.Errorf("target %q: %v", target, err)
		}
	}

	opts := x.options(x.manifest(map[string][]byte{"plugins/a/SKILL.md": []byte("# a")}))
	opts.TargetPath = "sub"
	if _, err := x.export(opts); exportCode(t, err) != export.CodeManifestInvalid {
		t.Errorf("target sub: %v", err)
	}
}

func TestManifestExportBranchMissing(t *testing.T) {
	x := newHubFixture(t, nil)
	x.hub.head = ""

	_, err := x.export(x.options(x.manifest(map[string][]byte{"plugins/a/SKILL.md": []byte("# a")})))
	if code := exportCode(t, err); code != export.CodeBranchMissing {
		t.Fatalf("code = %s", code)
	}
}

func TestManifestExportLargeManifestMemoryCeiling(t *testing.T) {
	if testing.Short() {
		t.Skip("builds a 250,000-entry manifest")
	}

	const n = 250_000
	x := newHubFixture(t, nil)

	entries := make([]manifest.Entry, n)
	listed := make([]remotestate.Entry, n)
	for i := range entries {
		p := fmt.Sprintf("plugins/p%04d/skills/s%06d/SKILL.md", i%2500, i)
		entries[i] = manifesttest.EntryFor(p, []byte(fmt.Sprintf("# skill %d\n", i)))
		listed[i] = remotestate.Entry{Path: p, Mode: remotestate.ModeFile, SHA: entries[i].GitBlobSHA}
	}
	m := x.manifestFromEntries(entries)

	listing, err := remotestate.FromEntries("", listed)
	if err != nil {
		t.Fatal(err)
	}
	x.hub.setHeadTree(listing.TreeSHA())
	listing.CommitSHA, _ = x.hub.Head()
	x.state, err = x.listings.Save(context.Background(), "remote-state/acme/", listing)
	if err != nil {
		t.Fatal(err)
	}
	opts := x.options(m)
	entries, listed, listing = nil, nil, nil

	defer debug.SetGCPercent(debug.SetGCPercent(20))
	runtime.GC()
	var before runtime.MemStats
	runtime.ReadMemStats(&before)

	var peak atomic.Uint64
	done := make(chan struct{})
	sampled := make(chan struct{})
	go func() {
		defer close(sampled)
		var stats runtime.MemStats
		for {
			runtime.ReadMemStats(&stats)
			if stats.HeapAlloc > peak.Load() {
				peak.Store(stats.HeapAlloc)
			}
			select {
			case <-done:
				return
			case <-time.After(5 * time.Millisecond):
			}
		}
	}()

	x.hub.resetCounters()
	result, err := x.export(opts)
	close(done)
	<-sampled
	if err != nil {
		t.Fatal(err)
	}

	growth := int64(peak.Load()) - int64(before.HeapAlloc)
	t.Logf("peak heap growth %d MiB over %d MiB baseline", growth>>20, before.HeapAlloc>>20)
	if growth > 256<<20 {
		t.Errorf("peak heap grew by %d MiB, want under 256 MiB", growth>>20)
	}
	if requests := x.hub.counts()["requests"]; requests > 3 {
		t.Errorf("unchanged 250k run made %d requests, want at most 3", requests)
	}
	if result.CommitsCreated != 0 || result.Stats.FilesSkipped != n {
		t.Errorf("result = %+v", result.Stats)
	}
}

func TestManifestExportReportsASampleOfMissingSources(t *testing.T) {
	x := newHubFixture(t, nil)
	files := map[string][]byte{
		"plugins/a/SKILL.md": []byte("# a\n"),
		"plugins/b/SKILL.md": []byte("# b\n"),
		"plugins/c/SKILL.md": []byte("# c\n"),
	}
	m := x.manifest(files)
	var missing []string
	for _, p := range []string{"plugins/a/SKILL.md", "plugins/b/SKILL.md"} {
		key := manifesttest.EntryFor(p, files[p]).Key
		x.storage.Delete(manifesttest.SourceBucket, key)
		missing = append(missing, key)
	}

	_, err := x.export(x.options(m))
	exportErr, ok := export.As(err)
	if !ok || exportErr.Code != export.CodeSourceNotFound {
		t.Fatalf("err = %v, want source_not_found", err)
	}
	if !sameStrings(exportErr.Details.Keys, missing) {
		t.Fatalf("keys = %v, want %v", exportErr.Details.Keys, missing)
	}
	assertCounts(t, x.hub, map[string]int{"commits": 0})
}

func sameStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	counts := map[string]int{}
	for _, s := range a {
		counts[s]++
	}
	for _, s := range b {
		counts[s]--
	}
	for _, n := range counts {
		if n != 0 {
			return false
		}
	}
	return true
}
