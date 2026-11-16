package manifest

import (
	"context"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"hash"
	"io"
	"strconv"
)

type SourceFile struct {
	Path       string
	Size       int64
	GitBlobSHA string // empty for bucket sources
	SHA256     string // empty for bucket sources
	Open       func(ctx context.Context) (io.ReadCloser, error)
}

// FileSource is what every exporter consumes, whether the files come from a manifest
// or a code bucket. Walk yields files in path order for manifest sources; bucket
// sources make no ordering promise.
type FileSource interface {
	Walk(ctx context.Context, fn func(SourceFile) error) error
}

type ContentMismatchError struct {
	Path   string
	Key    string
	Reason string
}

func (e *ContentMismatchError) Error() string {
	return fmt.Sprintf("content of %s (%s) doesn't match the manifest: %s", e.Path, e.Key, e.Reason)
}

type manifestSource struct {
	manifest *Manifest
	storage  Storage
}

// Source resolves entries to their objects in the header's sourceBucket. Every Open
// verifies size, git blob SHA and sha256 while reading and fails with
// *ContentMismatchError at EOF if they differ.
func (m *Manifest) Source(storage Storage) FileSource {
	return &manifestSource{manifest: m, storage: storage}
}

func (s *manifestSource) Walk(ctx context.Context, fn func(SourceFile) error) error {
	return s.manifest.Walk(ctx, func(entry Entry) error {
		return fn(s.file(entry))
	})
}

func (s *manifestSource) file(entry Entry) SourceFile {
	bucket := s.manifest.Header.SourceBucket

	return SourceFile{
		Path:       entry.Path,
		Size:       entry.Size,
		GitBlobSHA: entry.GitBlobSHA,
		SHA256:     entry.SHA256,
		Open: func(ctx context.Context) (io.ReadCloser, error) {
			body, err := s.storage.OpenObject(ctx, bucket, entry.Key)
			if err != nil {
				if errors.Is(err, ErrObjectNotFound) {
					return nil, &SourceNotFoundError{Bucket: bucket, Key: entry.Key, Path: entry.Path, Err: err}
				}
				return nil, fmt.Errorf("open source %s/%s for %s: %w", bucket, entry.Key, entry.Path, err)
			}

			return NewVerifyingReader(body, entry), nil
		},
	}
}

type verifyingReader struct {
	body   io.ReadCloser
	entry  Entry
	git    hash.Hash
	sha    hash.Hash
	read   int64
	failed error
}

// NewVerifyingReader checks that body has exactly entry.Size bytes with entry's git blob
// SHA and sha256. The check happens as the last byte is consumed, so callers must read
// to EOF before trusting what they forwarded.
func NewVerifyingReader(body io.ReadCloser, entry Entry) io.ReadCloser {
	git := sha1.New()
	fmt.Fprintf(git, "blob %s\x00", strconv.FormatInt(entry.Size, 10))

	return &verifyingReader{body: body, entry: entry, git: git, sha: sha256.New()}
}

func (r *verifyingReader) Read(p []byte) (int, error) {
	if r.failed != nil {
		return 0, r.failed
	}

	n, err := r.body.Read(p)
	r.read += int64(n)
	if r.read > r.entry.Size {
		return 0, r.mismatch(fmt.Sprintf("object is larger than %d bytes", r.entry.Size))
	}
	r.git.Write(p[:n])
	r.sha.Write(p[:n])

	if err == io.EOF {
		if verifyErr := r.verify(); verifyErr != nil {
			return n, verifyErr
		}
	}

	return n, err
}

func (r *verifyingReader) verify() error {
	switch {
	case r.read != r.entry.Size:
		return r.mismatch(fmt.Sprintf("object has %d bytes, manifest says %d", r.read, r.entry.Size))
	case hex.EncodeToString(r.git.Sum(nil)) != r.entry.GitBlobSHA:
		return r.mismatch("git blob SHA differs")
	case hex.EncodeToString(r.sha.Sum(nil)) != r.entry.SHA256:
		return r.mismatch("sha256 differs")
	}

	return nil
}

func (r *verifyingReader) mismatch(reason string) error {
	r.failed = &ContentMismatchError{Path: r.entry.Path, Key: r.entry.Key, Reason: reason}
	return r.failed
}

func (r *verifyingReader) Close() error { return r.body.Close() }

// ExpectedDeletes yields, in path order, the paths in prev that are absent from cur.
// A nil prev yields nothing: without a previous manifest no delete is expected.
func ExpectedDeletes(ctx context.Context, prev, cur *Manifest, fn func(path string) error) error {
	if prev == nil {
		return nil
	}

	prevIt, err := prev.Entries()
	if err != nil {
		return err
	}
	defer prevIt.Close()

	curIt, err := cur.Entries()
	if err != nil {
		return err
	}
	defer curIt.Close()

	hasCur := curIt.Next()
	for prevIt.Next() {
		if err := ctx.Err(); err != nil {
			return err
		}

		path := prevIt.Entry().Path
		for hasCur && curIt.Entry().Path < path {
			hasCur = curIt.Next()
		}
		if hasCur && curIt.Entry().Path == path {
			continue
		}
		if err := fn(path); err != nil {
			return err
		}
	}

	if err := prevIt.Err(); err != nil {
		return err
	}
	return curIt.Err()
}
