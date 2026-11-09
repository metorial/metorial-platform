// Package manifesttest builds manifests and serves objects in memory for tests.
package manifesttest

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash/crc32"
	"io"
	"sort"
	"sync"

	"github.com/metorial/metorial/services/code-bucket/pkg/manifest"
)

const SourceBucket = "test-files"

func GitBlobSHA(content []byte) string {
	h := sha1.New()
	fmt.Fprintf(h, "blob %d\x00", len(content))
	h.Write(content)
	return hex.EncodeToString(h.Sum(nil))
}

func SHA256(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}

// EntryFor describes content stored under its content-addressed blob key.
func EntryFor(path string, content []byte) manifest.Entry {
	sha := SHA256(content)

	return manifest.Entry{
		Path:       path,
		GitBlobSHA: GitBlobSHA(content),
		SHA256:     sha,
		Size:       int64(len(content)),
		CRC32:      crc32.ChecksumIEEE(content),
		Key:        "skill-sync/blobs/sha256/" + sha,
	}
}

type wireEntry struct {
	T string `json:"t"`
	P string `json:"p"`
	G string `json:"g"`
	S string `json:"s"`
	N int64  `json:"n"`
	C uint32 `json:"c"`
	K string `json:"k"`
}

type wireHeader struct {
	T             string         `json:"t"`
	V             int            `json:"v"`
	Kind          string         `json:"kind"`
	DestinationID string         `json:"destinationId"`
	SourceBucket  string         `json:"sourceBucket"`
	EntryCount    int            `json:"entryCount"`
	TotalBytes    int64          `json:"totalBytes"`
	Scope         manifest.Scope `json:"scope"`
}

// Encode writes the v1 NDJSON format, sorting entries by path and filling in the
// header counts. It returns the uncompressed bytes; their sha256 is the manifest id.
func Encode(header manifest.Header, entries []manifest.Entry) []byte {
	sorted := append([]manifest.Entry(nil), entries...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Path < sorted[j].Path })

	var total int64
	for _, e := range sorted {
		total += e.Size
	}

	if header.DestinationID == "" {
		header.DestinationID = "sdst_test"
	}
	if header.SourceBucket == "" {
		header.SourceBucket = SourceBucket
	}
	scope := header.Scope
	if scope.Dirs == nil {
		scope.Dirs = []string{}
	}
	if scope.Files == nil {
		scope.Files = []string{}
	}
	if scope.Globs == nil {
		scope.Globs = []string{}
	}

	var buf bytes.Buffer
	writeLine(&buf, wireHeader{
		T:             "header",
		V:             manifest.FormatVersion,
		Kind:          manifest.Kind,
		DestinationID: header.DestinationID,
		SourceBucket:  header.SourceBucket,
		EntryCount:    len(sorted),
		TotalBytes:    total,
		Scope:         scope,
	})
	for _, e := range sorted {
		writeLine(&buf, wireEntry{T: "entry", P: e.Path, G: e.GitBlobSHA, S: e.SHA256, N: e.Size, C: e.CRC32, K: e.Key})
	}

	return buf.Bytes()
}

func writeLine(buf *bytes.Buffer, v any) {
	line, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	buf.Write(line)
	buf.WriteByte('\n')
}

func Gzip(data []byte) []byte {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	gz.Write(data)
	gz.Close()
	return buf.Bytes()
}

type Storage struct {
	mu      sync.Mutex
	objects map[string][]byte
	opens   map[string]int
}

func NewStorage() *Storage {
	return &Storage{objects: map[string][]byte{}, opens: map[string]int{}}
}

func (s *Storage) Put(bucket, key string, data []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.objects[bucket+"/"+key] = data
}

func (s *Storage) Delete(bucket, key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.objects, bucket+"/"+key)
}

// PutManifest stores the manifest gzip-compressed under skill-sync/manifests/ and
// returns its reference.
func (s *Storage) PutManifest(bucket string, data []byte) manifest.Ref {
	sha := SHA256(data)
	ref := manifest.Ref{Bucket: bucket, Key: manifest.KeyPrefix + "sdst_test/" + sha + ".ndjson", SHA256: sha}
	s.Put(bucket, ref.Key, Gzip(data))
	return ref
}

// PutContent stores content under the entry key EntryFor would produce.
func (s *Storage) PutContent(path string, content []byte) manifest.Entry {
	entry := EntryFor(path, content)
	s.Put(SourceBucket, entry.Key, content)
	return entry
}

func (s *Storage) Opens(bucket, key string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.opens[bucket+"/"+key]
}

func (s *Storage) OpenObject(ctx context.Context, bucket, key string) (io.ReadCloser, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.opens[bucket+"/"+key]++
	data, ok := s.objects[bucket+"/"+key]
	if !ok {
		return nil, fmt.Errorf("%s/%s: %w", bucket, key, manifest.ErrObjectNotFound)
	}
	return io.NopCloser(bytes.NewReader(data)), nil
}
