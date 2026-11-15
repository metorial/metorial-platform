package manifest_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"regexp"
	"strings"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
	"github.com/metorial/metorial/services/code-bucket/pkg/manifest/manifesttest"
)

const manifestBucket = "test-files"

var testScope = manifest.Scope{
	Dirs:  []string{"plugins"},
	Files: []string{".claude-plugin/marketplace.json"},
	Globs: []string{},
}

func allowTestBuckets(bucket string) bool { return bucket == manifestBucket }

func openRaw(t *testing.T, raw []byte) (*manifest.Manifest, error) {
	t.Helper()

	storage := manifesttest.NewStorage()
	ref := storage.PutManifest(manifestBucket, raw)
	return manifest.Open(context.Background(), storage, ref, manifest.Options{AllowBucket: allowTestBuckets, SpoolDir: t.TempDir()})
}

func sampleEntries() []manifest.Entry {
	return []manifest.Entry{
		manifesttest.EntryFor("plugins/acme/SKILL.md", []byte("# acme\n")),
		manifesttest.EntryFor(".claude-plugin/marketplace.json", []byte(`{"plugins":[]}`)),
		manifesttest.EntryFor("plugins/acme/assets/logo.png", []byte{0x89, 'P', 'N', 'G'}),
	}
}

func TestOpenReadsAValidManifest(t *testing.T) {
	m, err := openRaw(t, manifesttest.Encode(manifest.Header{Scope: testScope}, sampleEntries()))
	if err != nil {
		t.Fatal(err)
	}
	defer m.Close()

	if m.Header.EntryCount != 3 || m.Header.SourceBucket != manifesttest.SourceBucket || m.Header.DestinationID != "sdst_test" {
		t.Fatalf("unexpected header %+v", m.Header)
	}
	if !m.Header.Scope.Contains("plugins/acme/SKILL.md") {
		t.Fatal("scope lost in parsing")
	}

	var paths []string
	if err := m.Walk(context.Background(), func(e manifest.Entry) error {
		paths = append(paths, e.Path)
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	want := []string{".claude-plugin/marketplace.json", "plugins/acme/SKILL.md", "plugins/acme/assets/logo.png"}
	if strings.Join(paths, ",") != strings.Join(want, ",") {
		t.Fatalf("paths = %v, want %v", paths, want)
	}
}

func TestOpenAcceptsUncompressedObjects(t *testing.T) {
	raw := manifesttest.Encode(manifest.Header{Scope: testScope}, sampleEntries())
	storage := manifesttest.NewStorage()
	ref := storage.PutManifest(manifestBucket, raw)
	storage.Put(ref.Bucket, ref.Key, raw)

	m, err := manifest.Open(context.Background(), storage, ref, manifest.Options{SpoolDir: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	m.Close()
}

func TestOpenAcceptsEmptyManifestWithoutTrailingNewline(t *testing.T) {
	raw := bytes.TrimSuffix(manifesttest.Encode(manifest.Header{Scope: testScope}, nil), []byte("\n"))

	m, err := openRaw(t, raw)
	if err != nil {
		t.Fatal(err)
	}
	defer m.Close()

	if m.Header.EntryCount != 0 {
		t.Fatalf("entryCount = %d", m.Header.EntryCount)
	}
}

func TestOpenRejectsInvalidManifests(t *testing.T) {
	valid := manifesttest.Encode(manifest.Header{Scope: testScope}, sampleEntries())
	lines := strings.Split(strings.TrimSuffix(string(valid), "\n"), "\n")
	join := func(l []string) []byte { return []byte(strings.Join(l, "\n") + "\n") }
	replaceLine := func(i int, old, new string) []byte {
		copied := append([]string(nil), lines...)
		copied[i] = strings.Replace(copied[i], old, new, 1)
		return join(copied)
	}

	entryA := manifesttest.EntryFor("plugins/a", []byte("a"))
	entryB := manifesttest.EntryFor("plugins/b", []byte("b"))

	tests := []struct {
		name   string
		raw    []byte
		reason string
	}{
		{"empty object", []byte{}, "empty"},
		{"entry before header", join(lines[1:]), "header"},
		{"wrong version", replaceLine(0, `"v":1`, `"v":2`), "version"},
		{"wrong kind", replaceLine(0, `"kind":"metorial.skill-destination-manifest"`, `"kind":"other"`), "kind"},
		{"missing destination", replaceLine(0, `"destinationId":"sdst_test",`, ""), "destinationId"},
		{"missing scope globs", replaceLine(0, `,"globs":[]`, ""), "scope"},
		{"scope with git dir", replaceLine(0, `"dirs":["plugins"]`, `"dirs":[".git"]`), "git_dir"},
		{"unknown header field", replaceLine(0, `"v":1`, `"v":1,"extra":true`), "unknown field"},
		{"disallowed source bucket", replaceLine(0, `"sourceBucket":"test-files"`, `"sourceBucket":"other-bucket"`), "not an allowed"},
		{"entry count too high", replaceLine(0, `"entryCount":3`, `"entryCount":4`), "entryCount"},
		{"entry count too low", replaceLine(0, `"entryCount":3`, `"entryCount":2`), "more entries"},
		{"total bytes mismatch", replaceLine(0, `"totalBytes":`, `"totalBytes":1`), "totalBytes"},
		{"unsorted", join([]string{lines[0], lines[2], lines[1], lines[3]}), "sorted"},
		{"duplicate", join([]string{strings.Replace(lines[0], `"entryCount":3`, `"entryCount":4`, 1), lines[1], lines[2], lines[2], lines[3]}), "unique"},
		{"short git sha", replaceLine(1, `"g":"`, `"g":"0`), "g must be"},
		{"uppercase sha256", replaceLine(1, `"s":"`, `"s":"A`), "s must be"},
		{"negative size", replaceLine(1, `"n":`, `"n":-`), "n must be"},
		{"fractional size", replaceLine(1, `"n":`, `"n":0.5`), "n"},
		{"missing crc", replaceLine(1, `,"c":`, `,"x":`), "unknown field"},
		{"empty key", []byte(regexp.MustCompile(`"k":"[^"]*"`).ReplaceAllString(string(valid), `"k":""`)), "k must be"},
		{"unknown entry field", replaceLine(1, `"t":"entry"`, `"t":"entry","m":"100755"`), "unknown field"},
		{"wrong entry type", replaceLine(1, `"t":"entry"`, `"t":"tree"`), `"entry"`},
		{"trailing whitespace", replaceLine(1, `}`, `} `), "whitespace"},
		{"blank line", join(append(append([]string(nil), lines...), "")), "empty line"},
		{"path with dotdot", replaceLine(2, `"p":"plugins/acme/SKILL.md"`, `"p":"plugins/../SKILL.md"`), "dot_segment"},
		{"gitattributes entry", replaceLine(2, `"p":"plugins/acme/SKILL.md"`, `"p":"plugins/acme/.gitattributes"`), "git_metadata_file"},
		{"file and directory", manifesttest.Encode(manifest.Header{Scope: testScope}, []manifest.Entry{
			entryA,
			{Path: "plugins/a-b", GitBlobSHA: entryB.GitBlobSHA, SHA256: entryB.SHA256, Size: 1, Key: entryB.Key},
			{Path: "plugins/a/x", GitBlobSHA: entryB.GitBlobSHA, SHA256: entryB.SHA256, Size: 1, Key: entryB.Key},
		}), "both a file and a directory"},
		{"oversized line", replaceLine(1, `"k":"`, `"k":"`+strings.Repeat("x", manifest.MaxLineBytes)), "longer than"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, err := openRaw(t, tt.raw)
			if err == nil {
				m.Close()
				t.Fatal("expected an error")
			}

			var invalid *manifest.InvalidError
			if !errors.As(err, &invalid) {
				t.Fatalf("want *InvalidError, got %T %v", err, err)
			}
			if !strings.Contains(err.Error(), tt.reason) {
				t.Fatalf("error %q doesn't mention %q", err, tt.reason)
			}
		})
	}
}

func TestOpenRejectsShaMismatch(t *testing.T) {
	raw := manifesttest.Encode(manifest.Header{Scope: testScope}, sampleEntries())
	storage := manifesttest.NewStorage()
	ref := storage.PutManifest(manifestBucket, raw)
	storage.Put(ref.Bucket, ref.Key, manifesttest.Gzip(bytes.Replace(raw, []byte("acme"), []byte("acmf"), 1)))

	_, err := manifest.Open(context.Background(), storage, ref, manifest.Options{SpoolDir: t.TempDir()})
	if err == nil || !strings.Contains(err.Error(), "sha256 mismatch") {
		t.Fatalf("want sha256 mismatch, got %v", err)
	}
}

func TestOpenPrefersShaMismatchOverStructuralErrors(t *testing.T) {
	raw := manifesttest.Encode(manifest.Header{Scope: testScope}, sampleEntries())
	storage := manifesttest.NewStorage()
	ref := storage.PutManifest(manifestBucket, raw)
	storage.Put(ref.Bucket, ref.Key, append([]byte("garbage\n"), raw...))

	_, err := manifest.Open(context.Background(), storage, ref, manifest.Options{SpoolDir: t.TempDir()})
	if err == nil || !strings.Contains(err.Error(), "sha256 mismatch") {
		t.Fatalf("want sha256 mismatch, got %v", err)
	}
}

func TestOpenValidatesTheReference(t *testing.T) {
	raw := manifesttest.Encode(manifest.Header{Scope: testScope}, sampleEntries())
	storage := manifesttest.NewStorage()
	ref := storage.PutManifest(manifestBucket, raw)

	tests := []struct {
		name string
		ref  manifest.Ref
	}{
		{"bucket not allowed", manifest.Ref{Bucket: "other", Key: ref.Key, SHA256: ref.SHA256}},
		{"key outside manifests prefix", manifest.Ref{Bucket: ref.Bucket, Key: "skill-sync/blobs/x", SHA256: ref.SHA256}},
		{"bad sha", manifest.Ref{Bucket: ref.Bucket, Key: ref.Key, SHA256: strings.ToUpper(ref.SHA256)}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := manifest.Open(context.Background(), storage, tt.ref, manifest.Options{AllowBucket: allowTestBuckets})

			var invalid *manifest.InvalidError
			if !errors.As(err, &invalid) {
				t.Fatalf("want *InvalidError, got %v", err)
			}
			if storage.Opens(tt.ref.Bucket, tt.ref.Key) != 0 {
				t.Fatal("storage was read before the reference was validated")
			}
		})
	}
}

func TestOpenReportsMissingManifestAsSourceNotFound(t *testing.T) {
	ref := manifest.Ref{Bucket: manifestBucket, Key: manifest.KeyPrefix + "sdst/x.ndjson", SHA256: strings.Repeat("a", 64)}

	_, err := manifest.Open(context.Background(), manifesttest.NewStorage(), ref, manifest.Options{})

	var notFound *manifest.SourceNotFoundError
	if !errors.As(err, &notFound) || notFound.Key != ref.Key {
		t.Fatalf("want SourceNotFoundError for %s, got %v", ref.Key, err)
	}
}

func TestOpenRejectsObjectsOverTheSizeLimit(t *testing.T) {
	header := manifesttest.Encode(manifest.Header{Scope: testScope}, nil)
	padding := bytes.Repeat([]byte("x"), manifest.MaxObjectBytes)

	_, err := manifest.Read(context.Background(), io.MultiReader(bytes.NewReader(header), bytes.NewReader(padding)), manifest.Ref{
		Bucket: manifestBucket, Key: manifest.KeyPrefix + "x", SHA256: strings.Repeat("a", 64),
	}, manifest.Options{SpoolDir: t.TempDir()})
	if err == nil {
		t.Fatal("expected an error")
	}
}

func TestCloseRemovesTheSpool(t *testing.T) {
	m, err := openRaw(t, manifesttest.Encode(manifest.Header{Scope: testScope}, sampleEntries()))
	if err != nil {
		t.Fatal(err)
	}

	if err := m.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := m.Entries(); err == nil {
		t.Fatal("Entries after Close should fail")
	}
}

func openEntries(t *testing.T, storage *manifesttest.Storage, entries []manifest.Entry) *manifest.Manifest {
	t.Helper()

	ref := storage.PutManifest(manifestBucket, manifesttest.Encode(manifest.Header{Scope: testScope}, entries))
	m, err := manifest.Open(context.Background(), storage, ref, manifest.Options{SpoolDir: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { m.Close() })
	return m
}

func TestExpectedDeletes(t *testing.T) {
	storage := manifesttest.NewStorage()
	entry := func(p string) manifest.Entry { return manifesttest.EntryFor(p, []byte(p)) }

	tests := []struct {
		name string
		prev []string
		cur  []string
		want []string
	}{
		{"no changes", []string{"plugins/a", "plugins/b"}, []string{"plugins/a", "plugins/b"}, nil},
		{"removed in the middle", []string{"plugins/a", "plugins/b", "plugins/c"}, []string{"plugins/a", "plugins/c"}, []string{"plugins/b"}},
		{"all removed", []string{"plugins/a", "plugins/b"}, nil, []string{"plugins/a", "plugins/b"}},
		{"only additions", nil, []string{"plugins/a"}, nil},
		{"interleaved", []string{"plugins/a", "plugins/c", "plugins/e"}, []string{"plugins/b", "plugins/c", "plugins/d"}, []string{"plugins/a", "plugins/e"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var prevEntries, curEntries []manifest.Entry
			for _, p := range tt.prev {
				prevEntries = append(prevEntries, entry(p))
			}
			for _, p := range tt.cur {
				curEntries = append(curEntries, entry(p))
			}

			var got []string
			err := manifest.ExpectedDeletes(context.Background(), openEntries(t, storage, prevEntries), openEntries(t, storage, curEntries), func(p string) error {
				got = append(got, p)
				return nil
			})
			if err != nil {
				t.Fatal(err)
			}
			if strings.Join(got, ",") != strings.Join(tt.want, ",") {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExpectedDeletesWithoutPreviousManifest(t *testing.T) {
	cur := openEntries(t, manifesttest.NewStorage(), sampleEntries())

	err := manifest.ExpectedDeletes(context.Background(), nil, cur, func(string) error {
		t.Fatal("no deletes are expected without a previous manifest")
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func readSource(t *testing.T, file manifest.SourceFile) ([]byte, error) {
	t.Helper()

	body, err := file.Open(context.Background())
	if err != nil {
		return nil, err
	}
	defer body.Close()
	return io.ReadAll(body)
}

func TestSourceVerifiesContent(t *testing.T) {
	storage := manifesttest.NewStorage()
	good := storage.PutContent("plugins/good", []byte("good content"))
	tampered := storage.PutContent("plugins/tampered", []byte("original"))
	storage.Put(manifesttest.SourceBucket, tampered.Key, []byte("replaced"))
	truncated := storage.PutContent("plugins/truncated", []byte("long content"))
	storage.Put(manifesttest.SourceBucket, truncated.Key, []byte("long"))
	longer := storage.PutContent("plugins/longer", []byte("abc"))
	storage.Put(manifesttest.SourceBucket, longer.Key, []byte("abcdef"))
	missing := manifesttest.EntryFor("plugins/missing", []byte("never stored"))

	m := openEntries(t, storage, []manifest.Entry{good, tampered, truncated, longer, missing})

	results := map[string]error{}
	contents := map[string][]byte{}
	err := m.Source(storage).Walk(context.Background(), func(file manifest.SourceFile) error {
		data, err := readSource(t, file)
		results[file.Path] = err
		contents[file.Path] = data
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	if results["plugins/good"] != nil || string(contents["plugins/good"]) != "good content" {
		t.Fatalf("good file: %v %q", results["plugins/good"], contents["plugins/good"])
	}
	for _, p := range []string{"plugins/tampered", "plugins/truncated", "plugins/longer"} {
		var mismatch *manifest.ContentMismatchError
		if !errors.As(results[p], &mismatch) || mismatch.Path != p {
			t.Errorf("%s: want ContentMismatchError, got %v", p, results[p])
		}
	}

	var notFound *manifest.SourceNotFoundError
	if !errors.As(results["plugins/missing"], &notFound) || notFound.Key != missing.Key || notFound.Path != "plugins/missing" {
		t.Errorf("missing: want SourceNotFoundError, got %v", results["plugins/missing"])
	}
}
