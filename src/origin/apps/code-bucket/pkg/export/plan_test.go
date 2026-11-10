package export

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/commitbatch"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest/manifesttest"
	"github.com/metorial/metorial/services/code-bucket/pkg/remotestate"
)

var marketplaceScope = manifest.Scope{
	Dirs:  []string{"plugins"},
	Files: []string{".claude-plugin/marketplace.json"},
	Globs: []string{"assets/logo.*"},
}

type countingStorage struct {
	*manifesttest.Storage

	mu          sync.Mutex
	contentOpen int
}

func (s *countingStorage) OpenObject(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	if !strings.HasPrefix(key, manifest.KeyPrefix) {
		s.mu.Lock()
		s.contentOpen++
		s.mu.Unlock()
	}
	return s.Storage.OpenObject(ctx, bucket, key)
}

func (s *countingStorage) opens() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.contentOpen
}

type fixture struct {
	t       *testing.T
	storage *countingStorage
}

func newFixture(t *testing.T) *fixture {
	return &fixture{t: t, storage: &countingStorage{Storage: manifesttest.NewStorage()}}
}

func (f *fixture) manifest(files map[string][]byte) *manifest.Manifest {
	f.t.Helper()

	entries := make([]manifest.Entry, 0, len(files))
	for p, content := range files {
		entries = append(entries, f.storage.PutContent(p, content))
	}
	return f.manifestFromEntries(entries)
}

func (f *fixture) manifestFromEntries(entries []manifest.Entry) *manifest.Manifest {
	f.t.Helper()

	data := manifesttest.Encode(manifest.Header{Scope: marketplaceScope}, entries)
	ref := f.storage.PutManifest("manifests", data)
	m, err := manifest.Open(context.Background(), f.storage, ref, manifest.Options{SpoolDir: f.t.TempDir()})
	if err != nil {
		f.t.Fatalf("open manifest: %v", err)
	}
	f.t.Cleanup(func() { m.Close() })
	return m
}

func listingOf(t *testing.T, files map[string][]byte) *remotestate.Listing {
	t.Helper()

	entries := make([]remotestate.Entry, 0, len(files))
	for p, content := range files {
		entries = append(entries, remotestate.Entry{Path: p, Mode: remotestate.ModeFile, SHA: GitBlobSHA(content)})
	}
	listing, err := remotestate.FromEntries("head", entries)
	if err != nil {
		t.Fatal(err)
	}
	return listing
}

func (f *fixture) plan(in PlanInput) (*Plan, error) {
	if in.Source == nil {
		in.Source = in.Manifest.Source(f.storage)
	}
	return PlanChanges(context.Background(), in)
}

func readAll(t *testing.T, c commitbatch.Change) []byte {
	t.Helper()

	body, err := c.Open(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer body.Close()
	content, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read %s: %v", c.Path, err)
	}
	return content
}

func skillFiles(n int) map[string][]byte {
	files := map[string][]byte{}
	for i := 0; i < n; i++ {
		files[fmt.Sprintf("plugins/p%03d/skills/s%d/SKILL.md", i%250, i)] = []byte(fmt.Sprintf("# skill %d\n", i))
	}
	return files
}

func kinds(changes []commitbatch.Change) map[commitbatch.ChangeKind]int {
	out := map[commitbatch.ChangeKind]int{}
	for _, c := range changes {
		out[c.Kind]++
	}
	return out
}

func TestPlanUnchangedManifestReadsNothing(t *testing.T) {
	f := newFixture(t)
	files := skillFiles(5000)

	plan, err := f.plan(PlanInput{Manifest: f.manifest(files), Remote: listingOf(t, files), SupportsReferences: true})
	if err != nil {
		t.Fatal(err)
	}
	if !plan.Empty() || plan.Skipped != 5000 || plan.FilesTotal != 5000 {
		t.Fatalf("plan = %+v", plan)
	}
	if f.storage.opens() != 0 {
		t.Fatalf("opened %d objects", f.storage.opens())
	}
}

func TestPlanOneChangedFile(t *testing.T) {
	f := newFixture(t)
	remote := skillFiles(100)
	files := skillFiles(100)
	files["plugins/p007/skills/s7/SKILL.md"] = []byte("changed\n")

	plan, err := f.plan(PlanInput{Manifest: f.manifest(files), Remote: listingOf(t, remote), SupportsReferences: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Content) != 1 || plan.Len() != 1 {
		t.Fatalf("plan = %+v", plan.Plan)
	}
	change := plan.Content[0]
	if change.BlobSHA != GitBlobSHA([]byte("changed\n")) || change.Size != 8 {
		t.Fatalf("change = %+v", change)
	}
	if f.storage.opens() != 0 {
		t.Fatal("planning must not read content")
	}
	if got := readAll(t, change); string(got) != "changed\n" {
		t.Fatalf("content = %q", got)
	}
}

func TestPlanDeduplicatesIdenticalContent(t *testing.T) {
	f := newFixture(t)
	files := map[string][]byte{}
	for i := 0; i < 100; i++ {
		files[fmt.Sprintf("plugins/p%03d/assets/logo.png", i)] = []byte("same logo bytes")
	}

	plan, err := f.plan(PlanInput{Manifest: f.manifest(files), Remote: remotestate.New(), SupportsReferences: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Content) != 1 || len(plan.References) != 99 || plan.Deduplicated != 99 {
		t.Fatalf("content=%d references=%d dedup=%d", len(plan.Content), len(plan.References), plan.Deduplicated)
	}
	for _, ref := range plan.References {
		if ref.BlobSHA != plan.Content[0].BlobSHA || ref.Open != nil {
			t.Fatalf("reference %+v", ref)
		}
	}
}

func TestPlanMovedDirectoryReadsNothing(t *testing.T) {
	f := newFixture(t)
	remote := map[string][]byte{}
	files := map[string][]byte{}
	for i := 0; i < 50; i++ {
		content := []byte(fmt.Sprintf("file %d", i))
		remote[fmt.Sprintf("plugins/old/skills/%02d.md", i)] = content
		files[fmt.Sprintf("plugins/new/skills/%02d.md", i)] = content
	}
	previous := f.manifest(remote)

	plan, err := f.plan(PlanInput{
		Manifest:           f.manifest(files),
		Previous:           previous,
		Remote:             listingOf(t, remote),
		SupportsReferences: true,
		Guard:              Guard{MaxUnexpectedDeletes: 0, MaxUnexpectedDeleteRatio: 0},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Content) != 0 || len(plan.References) != 50 || plan.Reused != 50 {
		t.Fatalf("content=%d references=%d", len(plan.Content), len(plan.References))
	}
	if got := kinds(plan.Final); got[commitbatch.ChangeDelete] != 50 || len(plan.UnexpectedDeletes) != 0 {
		t.Fatalf("final=%v unexpected=%d", got, len(plan.UnexpectedDeletes))
	}
	if f.storage.opens() != 0 {
		t.Fatalf("opened %d objects", f.storage.opens())
	}
}

func TestPlanWithoutReferenceSupportWritesContent(t *testing.T) {
	f := newFixture(t)
	remote := map[string][]byte{"plugins/old/a.md": []byte("a")}
	files := map[string][]byte{"plugins/new/a.md": []byte("a"), "plugins/new/b.md": []byte("a")}

	plan, err := f.plan(PlanInput{Manifest: f.manifest(files), Remote: listingOf(t, remote), Guard: Guard{AllowMassDelete: true}})
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Content) != 2 || len(plan.References) != 0 {
		t.Fatalf("content=%d references=%d", len(plan.Content), len(plan.References))
	}
}

func TestPlanIndexFilesGoLastBeforeDeletes(t *testing.T) {
	f := newFixture(t)
	remote := map[string][]byte{"plugins/gone/x.md": []byte("gone"), "plugins/a/plugin.json": []byte("{}")}
	files := map[string][]byte{
		".claude-plugin/marketplace.json": []byte(`{"plugins":["a"]}`),
		"plugins/a/plugin.json":           []byte(`{"name":"a"}`),
		"plugins/a/skills/x/SKILL.md":     []byte("x"),
	}

	plan, err := f.plan(PlanInput{Manifest: f.manifest(files), Remote: listingOf(t, remote), SupportsReferences: true, Guard: Guard{AllowMassDelete: true}})
	if err != nil {
		t.Fatal(err)
	}

	var final []string
	for _, c := range plan.Final {
		final = append(final, c.Kind.String()+":"+c.Path)
	}
	want := "add:.claude-plugin/marketplace.json,add:plugins/a/plugin.json,delete:plugins/gone/x.md"
	if strings.Join(final, ",") != want {
		t.Fatalf("final = %v", final)
	}
	if len(plan.Content) != 1 || plan.Content[0].Path != "plugins/a/skills/x/SKILL.md" {
		t.Fatalf("content = %+v", plan.Content)
	}
}

func TestPlanKeepsExecutableMode(t *testing.T) {
	f := newFixture(t)
	listing, _ := remotestate.FromEntries("head", []remotestate.Entry{
		{Path: "plugins/a/run.sh", Mode: remotestate.ModeExecutable, SHA: GitBlobSHA([]byte("old"))},
		{Path: "plugins/a/same.sh", Mode: remotestate.ModeExecutable, SHA: GitBlobSHA([]byte("same"))},
	})

	plan, err := f.plan(PlanInput{Manifest: f.manifest(map[string][]byte{"plugins/a/run.sh": []byte("new"), "plugins/a/same.sh": []byte("same")}), Remote: listing})
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Content) != 1 || plan.Content[0].Mode != remotestate.ModeExecutable || plan.Skipped != 1 {
		t.Fatalf("plan = %+v skipped=%d", plan.Content, plan.Skipped)
	}
}

func TestPlanScopeDeletes(t *testing.T) {
	f := newFixture(t)
	remote := map[string][]byte{
		"plugins/a/keep.md":               []byte("keep"),
		"plugins/a/stale.md":              []byte("stale"),
		"plugins/b/old/deep.md":           []byte("deep"),
		".claude-plugin/marketplace.json": []byte("{}"),
		"assets/logo.svg":                 []byte("<svg/>"),
		"assets/banner.png":               []byte("banner"),
		"README.md":                       []byte("readme"),
		"pluginsx/file.md":                []byte("not in scope"),
		".gitattributes":                  []byte("*.bin filter=lfs\n"),
	}
	files := map[string][]byte{"plugins/a/keep.md": []byte("keep")}

	plan, err := f.plan(PlanInput{Manifest: f.manifest(files), Remote: listingOf(t, remote), SupportsReferences: true, Guard: Guard{AllowMassDelete: true}})
	if err != nil {
		t.Fatal(err)
	}

	want := ".claude-plugin/marketplace.json,assets/logo.svg,plugins/a/stale.md,plugins/b/old/deep.md"
	if got := strings.Join(plan.Deletes, ","); got != want {
		t.Fatalf("deletes = %s", got)
	}
	if plan.ScopeEntries != 5 {
		t.Fatalf("scope entries = %d", plan.ScopeEntries)
	}
}

func TestPlanDeletionGuard(t *testing.T) {
	remote := map[string][]byte{}
	for i := 0; i < 40; i++ {
		remote[fmt.Sprintf("plugins/p%02d/SKILL.md", i)] = []byte(fmt.Sprintf("skill %d", i))
	}
	kept := map[string][]byte{"plugins/p00/SKILL.md": remote["plugins/p00/SKILL.md"]}
	guard := Guard{MaxUnexpectedDeletes: 10, MaxUnexpectedDeleteRatio: 0.1}

	tests := []struct {
		name         string
		previous     map[string][]byte
		guard        Guard
		wantTripped  bool
		wantDeletes  int
		wantExpected int
	}{
		{name: "no previous manifest trips", guard: guard, wantTripped: true},
		{name: "previous manifest explains deletes", previous: remote, guard: guard, wantDeletes: 39, wantExpected: 39},
		{name: "previous manifest unrelated trips", previous: kept, guard: guard, wantTripped: true},
		{name: "allow mass delete", guard: Guard{MaxUnexpectedDeletes: 10, MaxUnexpectedDeleteRatio: 0.1, AllowMassDelete: true}, wantDeletes: 39},
		{name: "count below the limit", guard: Guard{MaxUnexpectedDeletes: 50, MaxUnexpectedDeleteRatio: 0}, wantDeletes: 39},
		{name: "ratio below the limit", guard: Guard{MaxUnexpectedDeletes: 0, MaxUnexpectedDeleteRatio: 0.99}, wantDeletes: 39},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			in := PlanInput{Manifest: f.manifest(kept), Remote: listingOf(t, remote), Guard: tc.guard, SupportsReferences: true}
			if tc.previous != nil {
				in.Previous = f.manifest(tc.previous)
			}

			plan, err := f.plan(in)
			if tc.wantTripped {
				exportErr, ok := As(err)
				if !ok || exportErr.Code != CodeDeletionGuardTripped || exportErr.Details.UnexpectedDeletes != 39 || exportErr.Details.ScopeEntries != 40 {
					t.Fatalf("expected deletion_guard_tripped, got %v", err)
				}
				if len(exportErr.Details.Paths) == 0 || exportErr.Details.Paths[0] != "plugins/p01/SKILL.md" {
					t.Fatalf("samples = %v", exportErr.Details.Paths)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if len(plan.Deletes) != tc.wantDeletes || len(plan.Deletes)-len(plan.UnexpectedDeletes) != tc.wantExpected {
				t.Fatalf("deletes=%d unexpected=%d", len(plan.Deletes), len(plan.UnexpectedDeletes))
			}
		})
	}
}

func describe(changes []commitbatch.Change) string {
	var out []string
	for _, c := range changes {
		entry := map[commitbatch.ChangeKind]string{commitbatch.ChangeAdd: "add", commitbatch.ChangeReference: "reference", commitbatch.ChangeDelete: "delete"}[c.Kind] + " " + c.Path
		if c.WithNext {
			entry += " +next"
		}
		out = append(out, entry)
	}
	return strings.Join(out, ", ")
}

func TestPlanFileDirectoryConflicts(t *testing.T) {
	tests := []struct {
		name     string
		remote   map[string][]byte
		files    map[string][]byte
		previous map[string][]byte
		guard    Guard

		wantContent, wantFinal string
		wantUnexpected         int
		wantCode               Code
		wantConflict           [2]string
	}{
		{
			name:           "remote file where the manifest has a directory",
			remote:         map[string][]byte{"plugins/a/skills": []byte("a file"), "plugins/a/keep.md": []byte("keep")},
			files:          map[string][]byte{"plugins/a/keep.md": []byte("keep"), "plugins/a/plugin.json": []byte("{}"), "plugins/a/skills/s/SKILL.md": []byte("s"), "plugins/a/skills/t/SKILL.md": []byte("t")},
			guard:          Guard{AllowMassDelete: true},
			wantContent:    "delete plugins/a/skills +next, add plugins/a/skills/s/SKILL.md, add plugins/a/skills/t/SKILL.md",
			wantFinal:      "add plugins/a/plugin.json",
			wantUnexpected: 1,
		},
		{
			name:           "remote directory where the manifest has a file",
			remote:         map[string][]byte{"plugins/a/notes/one.md": []byte("1"), "plugins/a/notes/deep/two.md": []byte("2"), "plugins/a/old.md": []byte("old")},
			files:          map[string][]byte{"plugins/a/notes": []byte("notes")},
			guard:          Guard{AllowMassDelete: true},
			wantContent:    "delete plugins/a/notes/deep/two.md +next, delete plugins/a/notes/one.md +next, add plugins/a/notes",
			wantFinal:      "delete plugins/a/old.md",
			wantUnexpected: 3,
		},
		{
			name:     "conflicting deletes count toward the deletion guard",
			remote:   map[string][]byte{"plugins/a/notes/one.md": []byte("1"), "plugins/a/notes/two.md": []byte("2"), "plugins/b/SKILL.md": []byte("b")},
			files:    map[string][]byte{"plugins/a/notes": []byte("notes"), "plugins/b/SKILL.md": []byte("b")},
			guard:    Guard{MaxUnexpectedDeletes: 1},
			wantCode: CodeDeletionGuardTripped,
		},
		{
			name:        "the previous manifest explains conflicting deletes",
			remote:      map[string][]byte{"plugins/a/notes/one.md": []byte("1"), "plugins/a/notes/two.md": []byte("2"), "plugins/b/SKILL.md": []byte("b")},
			files:       map[string][]byte{"plugins/a/notes": []byte("notes"), "plugins/b/SKILL.md": []byte("b")},
			previous:    map[string][]byte{"plugins/a/notes/one.md": []byte("1"), "plugins/a/notes/two.md": []byte("2")},
			guard:       Guard{MaxUnexpectedDeletes: 1},
			wantContent: "delete plugins/a/notes/one.md +next, delete plugins/a/notes/two.md +next, add plugins/a/notes",
		},
		{
			name:         "remote file outside the scope",
			remote:       map[string][]byte{"assets": []byte("not ours")},
			files:        map[string][]byte{"assets/logo.svg": []byte("<svg/>")},
			wantCode:     CodePathConflict,
			wantConflict: [2]string{"assets/logo.svg", "assets"},
		},
		{
			name:         "remote directory with content outside the scope",
			remote:       map[string][]byte{".claude-plugin/marketplace.json/readme.md": []byte("not ours")},
			files:        map[string][]byte{".claude-plugin/marketplace.json": []byte("{}")},
			wantCode:     CodePathConflict,
			wantConflict: [2]string{".claude-plugin/marketplace.json", ".claude-plugin/marketplace.json/readme.md"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			in := PlanInput{Manifest: f.manifest(tc.files), Remote: listingOf(t, tc.remote), Guard: tc.guard, SupportsReferences: true}
			if tc.previous != nil {
				in.Previous = f.manifest(tc.previous)
			}

			plan, err := f.plan(in)
			if tc.wantCode != "" {
				exportErr, ok := As(err)
				if !ok || exportErr.Code != tc.wantCode {
					t.Fatalf("expected %s, got %v", tc.wantCode, err)
				}
				if tc.wantCode == CodePathConflict && (exportErr.Details.Path != tc.wantConflict[0] || len(exportErr.Details.Paths) != 1 || exportErr.Details.Paths[0] != tc.wantConflict[1]) {
					t.Fatalf("details = %+v", exportErr.Details)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}

			if got := describe(plan.Content); got != tc.wantContent {
				t.Fatalf("content = %s", got)
			}
			if got := describe(plan.Final); got != tc.wantFinal {
				t.Fatalf("final = %s", got)
			}
			if len(plan.UnexpectedDeletes) != tc.wantUnexpected {
				t.Fatalf("unexpected deletes = %v", plan.UnexpectedDeletes)
			}
		})
	}
}

type blobReader struct {
	blobs map[string][]byte
	reads int
}

func (b *blobReader) read(ctx context.Context, sha string) ([]byte, error) {
	b.reads++
	content, ok := b.blobs[sha]
	if !ok {
		return nil, errors.New("blob not found")
	}
	return content, nil
}

func pointerFor(content []byte) []byte {
	return gitlfs.FormatPointer(gitlfs.OIDFor(content), int64(len(content)))
}

func TestPlanLFS(t *testing.T) {
	big := bytes.Repeat([]byte("L"), 64)
	other := bytes.Repeat([]byte("M"), 64)
	existingAttributes := []byte("*.psd filter=lfs diff=lfs merge=lfs -text\n")
	coveringAttributes := []byte("plugins/a/big.bin filter=lfs diff=lfs merge=lfs -text\n")

	tests := []struct {
		name            string
		remote          map[string][]byte
		files           map[string][]byte
		wantContent     []string
		wantReferences  int
		wantLFSObjects  int
		wantBlobReads   int
		wantAttributes  string
		wantSkipped     int
		wantNoLFSObject bool
	}{
		{
			name:        "unchanged pointer is skipped without reading attributes",
			remote:      map[string][]byte{"plugins/a/big.bin": pointerFor(big), ".gitattributes": coveringAttributes},
			files:       map[string][]byte{"plugins/a/big.bin": big},
			wantSkipped: 1,
		},
		{
			name:           "new LFS file uploads the object and creates attributes",
			files:          map[string][]byte{"plugins/a/big.bin": big, "plugins/a/small.md": []byte("small")},
			wantContent:    []string{".gitattributes", "plugins/a/big.bin", "plugins/a/small.md"},
			wantLFSObjects: 1,
			wantAttributes: string(coveringAttributes),
		},
		{
			name:           "existing attributes are merged",
			remote:         map[string][]byte{".gitattributes": existingAttributes},
			files:          map[string][]byte{"plugins/a/big.bin": big},
			wantContent:    []string{".gitattributes", "plugins/a/big.bin"},
			wantLFSObjects: 1,
			wantBlobReads:  1,
			wantAttributes: string(existingAttributes) + string(coveringAttributes),
		},
		{
			name:           "attributes already covering the path are left alone",
			remote:         map[string][]byte{".gitattributes": coveringAttributes, "plugins/a/big.bin": pointerFor(other)},
			files:          map[string][]byte{"plugins/a/big.bin": big},
			wantContent:    []string{"plugins/a/big.bin"},
			wantLFSObjects: 1,
			wantBlobReads:  1,
		},
		{
			name:           "pointer present at another path becomes a reference",
			remote:         map[string][]byte{"plugins/old/big.bin": pointerFor(big), ".gitattributes": coveringAttributes},
			files:          map[string][]byte{"plugins/a/big.bin": big, "plugins/old/big.bin": big},
			wantContent:    []string{".gitattributes"},
			wantReferences: 1,
			wantBlobReads:  1,
			wantSkipped:    1,
			wantAttributes: string(coveringAttributes) + "plugins/old/big.bin filter=lfs diff=lfs merge=lfs -text\n",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			blobs := &blobReader{blobs: map[string][]byte{}}
			for _, content := range tc.remote {
				blobs.blobs[GitBlobSHA(content)] = content
			}

			plan, err := f.plan(PlanInput{
				Manifest:           f.manifest(tc.files),
				Remote:             listingOf(t, tc.remote),
				LFSThresholdBytes:  32,
				SupportsReferences: true,
				ReadBlob:           blobs.read,
			})
			if err != nil {
				t.Fatal(err)
			}

			var content []string
			for _, c := range plan.Content {
				content = append(content, c.Path)
			}
			if strings.Join(content, ",") != strings.Join(tc.wantContent, ",") {
				t.Fatalf("content = %v, want %v", content, tc.wantContent)
			}
			if len(plan.References) != tc.wantReferences || plan.LFSObjects != tc.wantLFSObjects || plan.Skipped != tc.wantSkipped {
				t.Fatalf("references=%d lfs=%d skipped=%d", len(plan.References), plan.LFSObjects, plan.Skipped)
			}
			if blobs.reads != tc.wantBlobReads {
				t.Fatalf("blob reads = %d, want %d", blobs.reads, tc.wantBlobReads)
			}
			for _, c := range plan.Content {
				switch c.Path {
				case ".gitattributes":
					if got := string(readAll(t, c)); got != tc.wantAttributes {
						t.Fatalf(".gitattributes = %q, want %q", got, tc.wantAttributes)
					}
				case "plugins/a/big.bin":
					if c.LFS == nil || c.LFS.OID != gitlfs.OIDFor(big) || c.LFS.Size != 64 {
						t.Fatalf("lfs = %+v", c.LFS)
					}
					if got := readAll(t, c); !bytes.Equal(got, pointerFor(big)) || c.BlobSHA != GitBlobSHA(pointerFor(big)) {
						t.Fatalf("pointer = %q", got)
					}
					body, _ := c.LFS.Open(context.Background())
					object, err := io.ReadAll(body)
					if err != nil || !bytes.Equal(object, big) {
						t.Fatalf("lfs object = %q, %v", object, err)
					}
				}
			}
			if f.storage.opens() > 1 {
				t.Fatalf("opened %d objects while planning", f.storage.opens())
			}
		})
	}
}

func TestPlanDuplicateLFSContentUploadsOnce(t *testing.T) {
	f := newFixture(t)
	big := bytes.Repeat([]byte("L"), 64)

	plan, err := f.plan(PlanInput{
		Manifest:           f.manifest(map[string][]byte{"plugins/a/x.bin": big, "plugins/b/x.bin": big}),
		Remote:             remotestate.New(),
		LFSThresholdBytes:  32,
		SupportsReferences: true,
		ReadBlob:           (&blobReader{}).read,
	})
	if err != nil {
		t.Fatal(err)
	}
	if plan.LFSObjects != 1 || len(plan.References) != 1 {
		t.Fatalf("lfs=%d references=%d", plan.LFSObjects, len(plan.References))
	}
}

func TestPlanFileSizeLimits(t *testing.T) {
	tests := []struct {
		name  string
		input PlanInput
		limit int64
	}{
		{name: "above the LFS plan limit", input: PlanInput{LFSThresholdBytes: 16, MaxLFSFileBytes: 32}, limit: 32},
		{name: "above the blob limit without LFS", input: PlanInput{MaxFileBytes: 32}, limit: 32},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t)
			in := tc.input
			in.Manifest = f.manifest(map[string][]byte{"plugins/a/huge.bin": bytes.Repeat([]byte("x"), 64)})
			in.Remote = remotestate.New()
			in.ReadBlob = (&blobReader{}).read

			_, err := f.plan(in)
			exportErr, ok := As(err)
			if !ok || exportErr.Code != CodeFileTooLarge || exportErr.Details.Path != "plugins/a/huge.bin" || exportErr.Details.Limit != tc.limit {
				t.Fatalf("expected file_too_large, got %v", err)
			}
		})
	}
}

func TestPlanVerifiesContentWhenRead(t *testing.T) {
	f := newFixture(t)
	entry := manifesttest.EntryFor("plugins/a/x.md", []byte("expected"))
	f.storage.Put(manifesttest.SourceBucket, entry.Key, []byte("tampered"))

	plan, err := f.plan(PlanInput{Manifest: f.manifestFromEntries([]manifest.Entry{entry}), Remote: remotestate.New()})
	if err != nil {
		t.Fatal(err)
	}

	body, err := plan.Content[0].Open(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	_, err = io.ReadAll(body)
	if exportErr, ok := As(FromError(err, Progress{})); !ok || exportErr.Code != CodeContentMismatch {
		t.Fatalf("expected content_mismatch, got %v", err)
	}
}

func TestPlanVerifiesEvenIfTheSourceDoesNot(t *testing.T) {
	f := newFixture(t)
	m := f.manifest(map[string][]byte{"plugins/a/x.md": []byte("expected")})

	plan, err := f.plan(PlanInput{Manifest: m, Remote: remotestate.New(), Source: lyingSource{m}})
	if err != nil {
		t.Fatal(err)
	}
	body, _ := plan.Content[0].Open(context.Background())
	if _, err := io.ReadAll(body); err == nil {
		t.Fatal("expected a content mismatch")
	}
}

type lyingSource struct{ m *manifest.Manifest }

func (s lyingSource) Walk(ctx context.Context, fn func(manifest.SourceFile) error) error {
	return s.m.Walk(ctx, func(e manifest.Entry) error {
		return fn(manifest.SourceFile{
			Path: e.Path, Size: e.Size, GitBlobSHA: e.GitBlobSHA, SHA256: e.SHA256,
			Open: func(context.Context) (io.ReadCloser, error) {
				return io.NopCloser(strings.NewReader("wrong!!!")), nil
			},
		})
	})
}

func TestEffectiveLFSThreshold(t *testing.T) {
	const limit = 28 << 20
	tests := []struct {
		name      string
		threshold int64
		want      int64
	}{
		{name: "no project threshold", threshold: 0, want: limit + 1},
		{name: "negative project threshold", threshold: -5, want: limit + 1},
		{name: "below the transport cap", threshold: 1 << 20, want: 1 << 20},
		{name: "at the transport cap", threshold: limit, want: limit},
		{name: "above the transport cap", threshold: 100 << 20, want: limit + 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := EffectiveLFSThreshold(tt.threshold, limit); got != tt.want {
				t.Fatalf("EffectiveLFSThreshold(%d) = %d, want %d", tt.threshold, got, tt.want)
			}
		})
	}
}
