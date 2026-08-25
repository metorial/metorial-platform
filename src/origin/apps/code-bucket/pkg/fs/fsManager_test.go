package fs

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"sort"
	"testing"

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
