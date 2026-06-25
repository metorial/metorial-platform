package fs

import (
	"reflect"
	"testing"
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

func TestNormalizeSeenPathDedupesRedisAndObjectPaths(t *testing.T) {
	if normalizeSeenPath("/src/index.ts") != normalizeSeenPath("src/index.ts") {
		t.Fatal("expected leading slash variants to normalize to the same seen path")
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
