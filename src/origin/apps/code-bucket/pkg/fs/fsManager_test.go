package fs

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-redis/redis/v8"
	objectstorage "github.com/metorial/object-storage/clients/go"
)

func TestPathMatchesPrefixNormalizesLeadingSlash(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		prefix   string
		expected bool
	}{
		{name: "empty prefix", path: "/src/index.ts", prefix: "", expected: true},
		{name: "matching slash variants", path: "src/index.ts", prefix: "/src", expected: true},
		{name: "matching inverse slash variants", path: "/src/index.ts", prefix: "src", expected: true},
		{name: "non matching prefix", path: "/src/index.ts", prefix: "/test", expected: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if actual := pathMatchesPrefix(tt.path, tt.prefix); actual != tt.expected {
				t.Fatalf("expected %v, got %v", tt.expected, actual)
			}
		})
	}
}

func TestPathWithinPrefixMatchesOnDirectoryBoundaries(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		prefix   string
		expected bool
	}{
		{name: "empty prefix matches everything", path: "skills/foo/a.md", prefix: "", expected: true},
		{name: "root prefix matches everything", path: "skills/foo/a.md", prefix: "/", expected: true},
		{name: "file inside the prefix", path: "skills/foo/a.md", prefix: "/skills/foo", expected: true},
		{name: "the prefix itself", path: "/skills/foo", prefix: "skills/foo", expected: true},
		{name: "trailing slash on the prefix", path: "skills/foo/a.md", prefix: "/skills/foo/", expected: true},
		{name: "sibling sharing a name prefix", path: "skills/foobar/a.md", prefix: "/skills/foo", expected: false},
		{name: "sibling file sharing a name prefix", path: "skills/foobar.md", prefix: "/skills/foo", expected: false},
		{name: "unrelated path", path: "plugins/foo/a.md", prefix: "/skills/foo", expected: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if actual := pathWithinPrefix(tt.path, tt.prefix); actual != tt.expected {
				t.Fatalf("expected %v, got %v", tt.expected, actual)
			}
		})
	}
}

func TestPrunePlanKeepsWrittenAndExcludedPaths(t *testing.T) {
	// A plugin sync: it owns its own directory but must not touch the skills
	// written by the separate skill tasks.
	plan := newPrunePlan(
		"/plugins/acme",
		[]string{"/plugins/acme/plugin.json", "/plugins/acme/mcp.json"},
		[]string{"/plugins/acme/skills"},
	)

	tests := []struct {
		path     string
		expected bool
	}{
		{path: "plugins/acme/plugin.json", expected: false},
		{path: "plugins/acme/mcp.json", expected: false},
		{path: "plugins/acme/stale.json", expected: true},
		{path: "plugins/acme/assets/old-logo.png", expected: true},
		{path: "plugins/acme/skills/demo/SKILL.md", expected: false},
		{path: "plugins/acme-other/plugin.json", expected: false},
		{path: "plugins/other/plugin.json", expected: false},
		{path: ".claude-plugin/marketplace.json", expected: false},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			if actual := plan.shouldDelete(tt.path); actual != tt.expected {
				t.Fatalf("expected shouldDelete(%q) to be %v", tt.path, tt.expected)
			}
		})
	}
}

func TestPrunePlanAtRootExcludesPluginSubtrees(t *testing.T) {
	// A marketplace sync: it owns the repository root except for plugins/.
	plan := newPrunePlan(
		"/",
		[]string{"/.claude-plugin/marketplace.json"},
		[]string{"/plugins"},
	)

	if plan.shouldDelete(".claude-plugin/marketplace.json") {
		t.Fatal("expected a written file to survive")
	}
	if plan.shouldDelete("plugins/acme/plugin.json") {
		t.Fatal("expected plugin files to be out of scope for a marketplace sync")
	}
	if !plan.shouldDelete(".cursor-plugin/marketplace.json") {
		t.Fatal("expected an unwritten root file to be pruned")
	}
}

func TestNormalizeSeenPathDedupesRedisAndObjectPaths(t *testing.T) {
	if normalizeSeenPath("/src/index.ts") != normalizeSeenPath("src/index.ts") {
		t.Fatal("expected leading slash variants to normalize to the same seen path")
	}
}

func TestObjectStorageKeyStripsLeadingSlash(t *testing.T) {
	if objectStorageKey("bucket", "/plugins/a.bin") != "bucket/plugins/a.bin" {
		t.Fatal("expected object key without a double slash")
	}
	if objectStorageKey("bucket", "plugins/a.bin") != "bucket/plugins/a.bin" {
		t.Fatal("expected object key to match for paths without a leading slash")
	}
}

func TestShouldBufferInRedisSkipsMegabyteFiles(t *testing.T) {
	if !shouldBufferInRedis(maxRedisCacheSize - 1) {
		t.Fatal("expected files under 1MB to buffer in redis")
	}
	if shouldBufferInRedis(maxRedisCacheSize) {
		t.Fatal("expected 1MB files to skip redis and write to object storage immediately")
	}
	if shouldBufferInRedis(maxRedisCacheSize + 1) {
		t.Fatal("expected files larger than 1MB to skip redis")
	}
}

// newStubObjectStorage serves the object-store list and bulk-delete endpoints
// from an in-memory key set.
func newStubObjectStorage(t *testing.T, keys []string) (*objectstorage.Client, func() []string) {
	t.Helper()

	deleted := []string{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if r.Method == http.MethodPost {
			var req struct {
				Keys []string `json:"keys"`
			}
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				t.Errorf("failed to decode delete request: %v", err)
			}

			results := make([]map[string]any, 0, len(req.Keys))
			for _, key := range req.Keys {
				deleted = append(deleted, key)
				results = append(results, map[string]any{"key": key, "deleted": true})
			}

			json.NewEncoder(w).Encode(map[string]any{
				"results": results,
				"deleted": len(results),
				"failed":  0,
			})
			return
		}

		prefix := r.URL.Query().Get("prefix")
		objects := make([]map[string]any, 0)
		for _, key := range keys {
			if prefix != "" && len(key) >= len(prefix) && key[:len(prefix)] == prefix {
				objects = append(objects, map[string]any{"key": key, "size": 1, "etag": "e", "last_modified": "", "metadata": map[string]string{}})
			}
		}

		json.NewEncoder(w).Encode(map[string]any{"objects": objects})
	}))
	t.Cleanup(server.Close)

	return objectstorage.NewClient(server.URL), func() []string {
		sort.Strings(deleted)
		return deleted
	}
}

func TestListObjectKeysUnderPrefixRespectsDirectoryBoundaries(t *testing.T) {
	client, _ := newStubObjectStorage(t, []string{
		"bkt_1/skills/foo/SKILL.md",
		"bkt_1/skills/foo/scripts/run.sh",
		"bkt_1/skills/foobar/SKILL.md",
		"bkt_1/skills/foo.md",
		"bkt_1/plugins/other/plugin.json",
	})

	fsm := &FileSystemManager{objectStorage: client, bucketName: "code-buckets"}

	// The listing prefix is not anchored on a boundary, so "skills/foobar" and
	// "skills/foo.md" come back from the store and have to be filtered out.
	keys, err := fsm.listObjectKeysUnderPrefix("bkt_1", "/skills/foo")
	if err != nil {
		t.Fatal(err)
	}

	sort.Strings(keys)
	expected := []string{"bkt_1/skills/foo/SKILL.md", "bkt_1/skills/foo/scripts/run.sh"}
	if !reflect.DeepEqual(keys, expected) {
		t.Fatalf("expected %#v, got %#v", expected, keys)
	}
}

func TestDeleteObjectKeysUsesBulkDelete(t *testing.T) {
	client, deletedKeys := newStubObjectStorage(t, nil)
	fsm := &FileSystemManager{objectStorage: client, bucketName: "code-buckets"}

	keys := []string{"bkt_1/a.md", "bkt_1/b.md"}
	if err := fsm.deleteObjectKeys(keys); err != nil {
		t.Fatal(err)
	}

	if !reflect.DeepEqual(deletedKeys(), keys) {
		t.Fatalf("expected %#v to be deleted, got %#v", keys, deletedKeys())
	}
}

func TestDeleteObjectKeysReportsPartialFailures(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"results": []map[string]any{
				{"key": "bkt_1/a.md", "deleted": true},
				{"key": "bkt_1/b.md", "deleted": false, "error": "access denied"},
			},
			"deleted": 1,
			"failed":  1,
		})
	}))
	defer server.Close()

	fsm := &FileSystemManager{
		objectStorage: objectstorage.NewClient(server.URL),
		bucketName:    "code-buckets",
	}

	err := fsm.deleteObjectKeys([]string{"bkt_1/a.md", "bkt_1/b.md"})
	if err == nil {
		t.Fatal("expected a per-key failure to surface as an error")
	}
}

// newFileObjectStorage serves a single object, writing its body in two halves
// so a caller that buffers can be told apart from one that streams. Nothing is
// written past the halfway point until release is closed.
func newFileObjectStorage(t *testing.T, content []byte, release <-chan struct{}) (*objectstorage.Client, func() []string) {
	t.Helper()

	requested := []string{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requested = append(requested, r.URL.Path)

		half := len(content) / 2
		w.Header().Set("Content-Type", "text/plain")
		w.Header().Set("Content-Length", strconv.Itoa(len(content)))
		w.Header().Set("Last-Modified", "2026-01-02T03:04:05Z")
		w.WriteHeader(http.StatusOK)

		w.Write(content[:half])
		w.(http.Flusher).Flush()

		if release != nil {
			<-release
		}
		w.Write(content[half:])
	}))
	t.Cleanup(server.Close)

	return objectstorage.NewClient(server.URL), func() []string { return requested }
}

// newTestFileSystemManager wires a manager against a real (in-memory) redis and
// the given object store.
func newTestFileSystemManager(t *testing.T, storage *objectstorage.Client) *FileSystemManager {
	t.Helper()

	server := miniredis.RunT(t)

	return &FileSystemManager{
		redis:         redis.NewClient(&redis.Options{Addr: server.Addr()}),
		objectStorage: storage,
		bucketName:    "code-buckets",
	}
}

func TestOpenBucketFileReturnsAReaderOverTheObject(t *testing.T) {
	content := []byte("streamed file content")
	storage, requested := newFileObjectStorage(t, content, nil)
	fsm := newTestFileSystemManager(t, storage)

	body, info, err := fsm.OpenBucketFile(context.Background(), "bkt_1", "docs/readme.md")
	if err != nil {
		t.Fatal(err)
	}
	defer body.Close()

	if info.Path != "/docs/readme.md" {
		t.Fatalf("unexpected path %q", info.Path)
	}
	if info.Size != int64(len(content)) {
		t.Fatalf("expected size %d, got %d", len(content), info.Size)
	}
	if info.ContentType != "text/plain" {
		t.Fatalf("unexpected content type %q", info.ContentType)
	}

	got, err := io.ReadAll(body)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, content) {
		t.Fatalf("read %q, want %q", got, content)
	}

	if paths := requested(); len(paths) != 1 || !strings.HasSuffix(paths[0], "bkt_1/docs/readme.md") {
		t.Fatalf("unexpected object requests: %#v", paths)
	}
}

func TestOpenBucketFileDoesNotBufferTheObject(t *testing.T) {
	content := []byte("first halfsecond half")
	release := make(chan struct{})
	defer close(release)

	storage, _ := newFileObjectStorage(t, content, release)
	fsm := newTestFileSystemManager(t, storage)

	// The store has not finished writing the body. A reader-returning call gets
	// here; one that buffered the object first would still be blocked.
	body, _, err := fsm.OpenBucketFile(context.Background(), "bkt_1", "big.bin")
	if err != nil {
		t.Fatal(err)
	}
	defer body.Close()

	head := make([]byte, len(content)/2)
	if _, err := io.ReadFull(body, head); err != nil {
		t.Fatal(err)
	}
	if string(head) != "first half" {
		t.Fatalf("read %q, want %q", head, "first half")
	}
}

func TestOpenBucketFileServesFilesStillInRedis(t *testing.T) {
	// Nothing has been flushed yet, so the object store would 404. Recently
	// written files have to come back from the redis buffer.
	storage, requested := newFileObjectStorage(t, nil, nil)
	fsm := newTestFileSystemManager(t, storage)

	content := []byte("not flushed yet")
	if err := fsm.PutBucketFile(context.Background(), "bkt_1", "/notes.txt", content, "text/plain"); err != nil {
		t.Fatal(err)
	}

	body, info, err := fsm.OpenBucketFile(context.Background(), "bkt_1", "/notes.txt")
	if err != nil {
		t.Fatal(err)
	}
	defer body.Close()

	if info.Size != int64(len(content)) {
		t.Fatalf("expected size %d, got %d", len(content), info.Size)
	}

	got, err := io.ReadAll(body)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, content) {
		t.Fatalf("read %q, want %q", got, content)
	}

	if paths := requested(); len(paths) != 0 {
		t.Fatalf("expected no object store reads, got %#v", paths)
	}
}

func TestOpenBucketFileReportsMissingFiles(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	fsm := newTestFileSystemManager(t, objectstorage.NewClient(server.URL))

	if _, _, err := fsm.OpenBucketFile(context.Background(), "bkt_1", "missing.txt"); err == nil {
		t.Fatal("expected an error for a missing file")
	}
}

type copyRequest struct {
	DestBucket   string
	DestKey      string
	SourceBucket string `json:"source_bucket"`
	SourceKey    string `json:"source_key"`
}

// newStubCopyObjectStorage serves the object-store copy endpoint and records
// every copy it is asked to perform.
func newStubCopyObjectStorage(t *testing.T, missingKeys map[string]bool) (*objectstorage.Client, func() []copyRequest) {
	t.Helper()

	var copies []copyRequest

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		// /buckets/{bucket}/copy-object/{key...}
		parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/buckets/"), "/copy-object/", 2)
		if len(parts) != 2 {
			t.Errorf("unexpected copy path: %s", r.URL.Path)
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		var req copyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Errorf("failed to decode copy request: %v", err)
		}
		req.DestBucket = parts[0]
		req.DestKey = parts[1]

		if missingKeys[req.SourceKey] {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		copies = append(copies, req)
		json.NewEncoder(w).Encode(map[string]any{
			"key": req.DestKey, "size": 1, "etag": "e",
			"last_modified": "", "metadata": map[string]string{},
		})
	}))
	t.Cleanup(server.Close)

	return objectstorage.NewClient(server.URL), func() []copyRequest {
		sort.Slice(copies, func(i, j int) bool { return copies[i].DestKey < copies[j].DestKey })
		return copies
	}
}

func newTestRedis(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	t.Helper()

	server := miniredis.RunT(t)
	return redis.NewClient(&redis.Options{Addr: server.Addr()}), server
}

func TestCopyBucketFilesWritesCanonicalObjectKeys(t *testing.T) {
	client, copies := newStubCopyObjectStorage(t, nil)
	redisClient, _ := newTestRedis(t)

	fsm := &FileSystemManager{
		objectStorage: client,
		bucketName:    "code-buckets",
		redis:         redisClient,
	}

	copied, err := fsm.CopyBucketFiles(context.Background(), "bkt_1", []CopyFileSource{
		{Path: "skills/demo/asset.bin", SourceBucket: "files", SourceKey: "str_a"},
		{Path: "/skills/demo/other.bin", SourceBucket: "files", SourceKey: "str_b"},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Paths come back canonicalized so callers can feed them straight into the
	// prune keep set.
	sort.Strings(copied)
	expectedPaths := []string{"/skills/demo/asset.bin", "/skills/demo/other.bin"}
	if !reflect.DeepEqual(copied, expectedPaths) {
		t.Fatalf("expected %#v, got %#v", expectedPaths, copied)
	}

	expected := []copyRequest{
		{
			DestBucket: "code-buckets", DestKey: "bkt_1/skills/demo/asset.bin",
			SourceBucket: "files", SourceKey: "str_a",
		},
		{
			DestBucket: "code-buckets", DestKey: "bkt_1/skills/demo/other.bin",
			SourceBucket: "files", SourceKey: "str_b",
		},
	}
	if !reflect.DeepEqual(copies(), expected) {
		t.Fatalf("expected %#v, got %#v", expected, copies())
	}
}

func TestCopyBucketFilesClearsStaleRedisBuffers(t *testing.T) {
	client, _ := newStubCopyObjectStorage(t, nil)
	redisClient, server := newTestRedis(t)

	// A previous small write left a buffered copy behind. If it survived, reads
	// would keep serving the old bytes.
	staleKeys := []string{
		"bucket:bkt_1:file:/skills/demo/asset.bin",
		"flush:bkt_1:/skills/demo/asset.bin",
		"bucket:bkt_1:file:skills/demo/asset.bin",
		"flush:bkt_1:skills/demo/asset.bin",
	}
	for _, key := range staleKeys {
		server.Set(key, "stale")
	}

	fsm := &FileSystemManager{
		objectStorage: client,
		bucketName:    "code-buckets",
		redis:         redisClient,
	}

	_, err := fsm.CopyBucketFiles(context.Background(), "bkt_1", []CopyFileSource{
		{Path: "skills/demo/asset.bin", SourceBucket: "files", SourceKey: "str_a"},
	})
	if err != nil {
		t.Fatal(err)
	}

	for _, key := range staleKeys {
		if server.Exists(key) {
			t.Fatalf("expected stale redis key %q to be cleared", key)
		}
	}
}

func TestCopyBucketFilesSurfacesSourceFailures(t *testing.T) {
	client, _ := newStubCopyObjectStorage(t, map[string]bool{"missing": true})
	redisClient, _ := newTestRedis(t)

	fsm := &FileSystemManager{
		objectStorage: client,
		bucketName:    "code-buckets",
		redis:         redisClient,
	}

	_, err := fsm.CopyBucketFiles(context.Background(), "bkt_1", []CopyFileSource{
		{Path: "a.bin", SourceBucket: "files", SourceKey: "missing"},
	})
	if err == nil {
		t.Fatal("expected a missing source object to surface as an error")
	}
}

func TestCopyBucketFilesEmptyIsNoop(t *testing.T) {
	fsm := &FileSystemManager{}

	copied, err := fsm.CopyBucketFiles(context.Background(), "bkt_1", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(copied) != 0 {
		t.Fatalf("expected no copies, got %#v", copied)
	}
}

func TestContentBatchAccumulatorFlushesByCombinedSize(t *testing.T) {
	var batches [][]string
	accumulator := &contentBatchAccumulator{
		maxBytes: 5,
		flush: func(batch []FileContentItem) error {
			paths := make([]string, 0, len(batch))
			for _, item := range batch {
				paths = append(paths, item.Info.Path)
			}
			batches = append(batches, paths)
			return nil
		},
	}

	items := []FileContentItem{
		{Info: FileInfo{Path: "a"}, Content: []byte("12")},
		{Info: FileInfo{Path: "b"}, Content: []byte("123")},
		{Info: FileInfo{Path: "c"}, Content: []byte("1234")},
		{Info: FileInfo{Path: "d"}, Content: []byte("123456")},
	}

	for _, item := range items {
		if err := accumulator.Add(item); err != nil {
			t.Fatal(err)
		}
	}
	if err := accumulator.Flush(); err != nil {
		t.Fatal(err)
	}

	expected := [][]string{{"a", "b"}, {"c"}, {"d"}}
	if !reflect.DeepEqual(batches, expected) {
		t.Fatalf("expected %#v, got %#v", expected, batches)
	}
}

func TestPutSignedURLFromReaderSetsExplicitContentLength(t *testing.T) {
	var (
		gotContentLength int64
		gotContentType   string
		gotBody          []byte
		gotMethod        string
	)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotContentLength = r.ContentLength
		gotContentType = r.Header.Get("Content-Type")
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	fsm := &FileSystemManager{httpClient: server.Client()}
	body := []byte("zip-bytes")

	err := fsm.putSignedURLFromReader(
		context.Background(),
		server.URL,
		bytes.NewReader(body),
		int64(len(body)),
		"application/zip",
	)
	if err != nil {
		t.Fatal(err)
	}

	if gotMethod != http.MethodPut {
		t.Fatalf("expected PUT, got %s", gotMethod)
	}

	// A presigned signature does not cover chunked encoding, so the length has to
	// be declared rather than left to the transport.
	if gotContentLength != int64(len(body)) {
		t.Fatalf("expected content length %d, got %d", len(body), gotContentLength)
	}
	if gotContentType != "application/zip" {
		t.Fatalf("expected application/zip, got %s", gotContentType)
	}
	if !bytes.Equal(gotBody, body) {
		t.Fatalf("expected body %q, got %q", body, gotBody)
	}
}

func TestPutSignedURLFromReaderSurfacesRejection(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("SignatureDoesNotMatch"))
	}))
	defer server.Close()

	fsm := &FileSystemManager{httpClient: server.Client()}

	err := fsm.putSignedURLFromReader(
		context.Background(),
		server.URL,
		bytes.NewReader([]byte("x")),
		1,
		"application/zip",
	)
	if err == nil {
		t.Fatal("expected an error for a rejected signed upload")
	}
	if !strings.Contains(err.Error(), "SignatureDoesNotMatch") {
		t.Fatalf("expected the provider message to be surfaced, got %v", err)
	}
}

func TestPutSignedURLFromReaderAcceptsNonOK2xx(t *testing.T) {
	// S3 answers a successful PUT with 200, but other providers use 201/204.
	for _, code := range []int{http.StatusOK, http.StatusCreated, http.StatusNoContent} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(code)
		}))

		fsm := &FileSystemManager{httpClient: server.Client()}
		err := fsm.putSignedURLFromReader(
			context.Background(),
			server.URL,
			bytes.NewReader([]byte("x")),
			1,
			"application/zip",
		)
		server.Close()

		if err != nil {
			t.Fatalf("expected status %d to be accepted, got %v", code, err)
		}
	}
}

func TestByteAdmissionBoundsWorkInFlight(t *testing.T) {
	admission := newByteAdmission(100)
	ctx := context.Background()

	if err := admission.acquire(ctx, 60); err != nil {
		t.Fatal(err)
	}

	// A second 60-byte item would take the total to 120, so it has to wait.
	acquired := make(chan struct{})
	go func() {
		if err := admission.acquire(ctx, 60); err != nil {
			t.Error(err)
			return
		}
		close(acquired)
	}()

	select {
	case <-acquired:
		t.Fatal("expected the second acquire to block while the budget is full")
	case <-time.After(50 * time.Millisecond):
	}

	admission.release(60)

	select {
	case <-acquired:
	case <-time.After(2 * time.Second):
		t.Fatal("expected the second acquire to proceed once the budget freed up")
	}
}

func TestByteAdmissionAdmitsSmallItemsTogether(t *testing.T) {
	admission := newByteAdmission(100)
	ctx := context.Background()

	for i := 0; i < 10; i++ {
		if err := admission.acquire(ctx, 10); err != nil {
			t.Fatal(err)
		}
	}

	if admission.inFlight != 100 {
		t.Fatalf("expected 100 bytes in flight, got %d", admission.inFlight)
	}
}

func TestByteAdmissionAdmitsAnOversizedItemAlone(t *testing.T) {
	admission := newByteAdmission(100)
	ctx := context.Background()

	// An item bigger than the whole budget must not deadlock.
	done := make(chan struct{})
	go func() {
		if err := admission.acquire(ctx, 5_000); err != nil {
			t.Error(err)
			return
		}
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("expected an oversized item to be admitted on its own")
	}
}

func TestByteAdmissionRespectsCancellation(t *testing.T) {
	admission := newByteAdmission(100)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if err := admission.acquire(ctx, 10); err == nil {
		t.Fatal("expected acquire to refuse a cancelled context")
	}
}
