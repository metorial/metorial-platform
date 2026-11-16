package manifest

import (
	"bufio"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

var ErrObjectNotFound = errors.New("object not found")

// Storage reads objects from object storage. Implementations return an error wrapping
// ErrObjectNotFound when the object doesn't exist.
type Storage interface {
	OpenObject(ctx context.Context, bucket, key string) (io.ReadCloser, error)
}

type Ref struct {
	Bucket string
	Key    string
	SHA256 string
}

type Options struct {
	// AllowBucket is checked for the manifest's own bucket and its header's sourceBucket.
	// Nil allows every bucket.
	AllowBucket func(bucket string) bool
	// SpoolDir holds the verified copy that Entries reads back. Empty means os.TempDir().
	SpoolDir string
}

// InvalidError means the manifest object itself can't be used: Metorial wrote something
// that breaks the format, or the bytes don't match the sha256 it was referenced by.
type InvalidError struct {
	Ref    Ref
	Line   int
	Path   string
	Reason string
}

func (e *InvalidError) Error() string {
	location := ""
	if e.Line > 0 {
		location = fmt.Sprintf(" (line %d)", e.Line)
	}

	return fmt.Sprintf("manifest %s/%s is invalid%s: %s", e.Ref.Bucket, e.Ref.Key, location, e.Reason)
}

// SourceNotFoundError is returned when the manifest or an object an entry points at is missing.
type SourceNotFoundError struct {
	Bucket string
	Key    string
	Path   string
	Err    error
}

func (e *SourceNotFoundError) Error() string {
	if e.Path != "" {
		return fmt.Sprintf("source object %s/%s for %s not found", e.Bucket, e.Key, e.Path)
	}

	return fmt.Sprintf("object %s/%s not found", e.Bucket, e.Key)
}

func (e *SourceNotFoundError) Unwrap() error { return e.Err }

// Manifest is a validated, sha256-verified manifest. Entries are read back from a local
// spool of the verified bytes, so iterating never touches object storage again and
// memory stays constant regardless of the entry count.
type Manifest struct {
	Ref    Ref
	Header Header

	spoolPath string
}

func Open(ctx context.Context, storage Storage, ref Ref, opts Options) (*Manifest, error) {
	if err := validateRef(ref, opts); err != nil {
		return nil, err
	}

	body, err := storage.OpenObject(ctx, ref.Bucket, ref.Key)
	if err != nil {
		if errors.Is(err, ErrObjectNotFound) {
			return nil, &SourceNotFoundError{Bucket: ref.Bucket, Key: ref.Key, Err: err}
		}
		return nil, fmt.Errorf("open manifest %s/%s: %w", ref.Bucket, ref.Key, err)
	}
	defer body.Close()

	return Read(ctx, body, ref, opts)
}

func validateRef(ref Ref, opts Options) error {
	switch {
	case ref.Bucket == "" || ref.Key == "":
		return &InvalidError{Ref: ref, Reason: "bucket and key are required"}
	case !strings.HasPrefix(ref.Key, KeyPrefix):
		return &InvalidError{Ref: ref, Reason: fmt.Sprintf("key must start with %q", KeyPrefix)}
	case !isLowerHex(ref.SHA256, 64):
		return &InvalidError{Ref: ref, Reason: "sha256 must be 64 lowercase hex characters"}
	case opts.AllowBucket != nil && !opts.AllowBucket(ref.Bucket):
		return &InvalidError{Ref: ref, Reason: fmt.Sprintf("bucket %q is not an allowed manifest source", ref.Bucket)}
	}

	return nil
}

// Read validates a manifest from r, which may be gzip-compressed or plain NDJSON. The
// sha256 is checked over the uncompressed bytes.
func Read(ctx context.Context, r io.Reader, ref Ref, opts Options) (*Manifest, error) {
	content, err := decompressed(r)
	if err != nil {
		return nil, &InvalidError{Ref: ref, Reason: err.Error()}
	}

	spool, err := os.CreateTemp(opts.SpoolDir, "manifest-*.ndjson")
	if err != nil {
		return nil, fmt.Errorf("create manifest spool: %w", err)
	}
	m := &Manifest{Ref: ref, spoolPath: spool.Name()}

	header, parseErr := parseStream(ctx, content, spool, ref, opts)
	closeErr := spool.Close()

	if parseErr == nil {
		parseErr = closeErr
	}
	if parseErr != nil {
		m.Close()
		return nil, parseErr
	}

	m.Header = header
	return m, nil
}

func (m *Manifest) Close() error {
	if m.spoolPath == "" {
		return nil
	}

	err := os.Remove(m.spoolPath)
	m.spoolPath = ""
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

func decompressed(r io.Reader) (io.Reader, error) {
	buffered := bufio.NewReader(r)

	magic, err := buffered.Peek(2)
	if err != nil && err != io.EOF {
		return nil, err
	}
	if len(magic) == 2 && magic[0] == 0x1f && magic[1] == 0x8b {
		gz, err := gzip.NewReader(buffered)
		if err != nil {
			return nil, fmt.Errorf("gzip: %w", err)
		}
		return gz, nil
	}

	return buffered, nil
}

type limitedReader struct {
	r         io.Reader
	remaining int64
}

var errObjectTooLarge = fmt.Errorf("manifest is larger than %d bytes uncompressed", MaxObjectBytes)

func (l *limitedReader) Read(p []byte) (int, error) {
	if l.remaining <= 0 {
		var probe [1]byte
		if n, _ := l.r.Read(probe[:]); n > 0 {
			return 0, errObjectTooLarge
		}
		return 0, io.EOF
	}

	if int64(len(p)) > l.remaining {
		p = p[:l.remaining]
	}
	n, err := l.r.Read(p)
	l.remaining -= int64(n)
	return n, err
}

func parseStream(ctx context.Context, content io.Reader, spool io.Writer, ref Ref, opts Options) (Header, error) {
	hasher := sha256.New()
	tee := io.TeeReader(&limitedReader{r: content, remaining: MaxObjectBytes}, io.MultiWriter(hasher, spool))

	scanner := bufio.NewScanner(tee)
	scanner.Buffer(make([]byte, 0, 64<<10), MaxLineBytes+1)

	v := validator{ref: ref, opts: opts}
	for scanner.Scan() {
		if v.line%1024 == 0 {
			if err := ctx.Err(); err != nil {
				return Header{}, err
			}
		}
		if err := v.add(scanner.Bytes()); err != nil {
			return Header{}, preferIntegrityError(err, tee, hasher, ref)
		}
	}
	if err := scanner.Err(); err != nil {
		reason := err.Error()
		if errors.Is(err, bufio.ErrTooLong) {
			reason = fmt.Sprintf("a line is longer than %d bytes", MaxLineBytes)
		}
		return Header{}, preferIntegrityError(&InvalidError{Ref: ref, Line: v.line + 1, Reason: reason}, tee, hasher, ref)
	}

	if err := v.finish(); err != nil {
		return Header{}, preferIntegrityError(err, tee, hasher, ref)
	}
	if got := hex.EncodeToString(hasher.Sum(nil)); got != ref.SHA256 {
		return Header{}, &InvalidError{Ref: ref, Reason: fmt.Sprintf("sha256 mismatch: content hashes to %s", got)}
	}

	return v.header, nil
}

// preferIntegrityError reports a sha256 mismatch instead of a structural error when the
// bytes aren't the ones Metorial referenced, since the structure error is then noise.
func preferIntegrityError(structural error, tee io.Reader, hasher interface{ Sum([]byte) []byte }, ref Ref) error {
	var invalid *InvalidError
	if !errors.As(structural, &invalid) {
		return structural
	}

	if _, err := io.Copy(io.Discard, tee); err != nil {
		return structural
	}
	if got := hex.EncodeToString(hasher.Sum(nil)); got != ref.SHA256 {
		return &InvalidError{Ref: ref, Reason: fmt.Sprintf("sha256 mismatch: content hashes to %s", got)}
	}

	return structural
}

type validator struct {
	ref  Ref
	opts Options

	line       int
	header     Header
	entries    int
	totalBytes int64
	lastPath   string

	// Files that a later, larger path could still place a file under ("a" before "a/b").
	pendingFiles []string
}

func (v *validator) fail(path, format string, args ...any) error {
	return &InvalidError{Ref: v.ref, Line: v.line, Path: path, Reason: fmt.Sprintf(format, args...)}
}

func (v *validator) add(line []byte) error {
	v.line++

	if v.line == 1 {
		header, err := parseHeader(line)
		if err != nil {
			return v.fail("", "%v", err)
		}
		if v.opts.AllowBucket != nil && !v.opts.AllowBucket(header.SourceBucket) {
			return v.fail("", "sourceBucket %q is not an allowed source bucket", header.SourceBucket)
		}
		v.header = header
		return nil
	}

	entry, err := parseEntry(line)
	if err != nil {
		path := ""
		var pathErr *PathError
		if errors.As(err, &pathErr) {
			path = pathErr.Path
		}
		return v.fail(path, "%v", err)
	}

	v.entries++
	if v.entries > v.header.EntryCount {
		return v.fail(entry.Path, "more entries than the header's entryCount %d", v.header.EntryCount)
	}
	if v.entries > 1 && entry.Path <= v.lastPath {
		return v.fail(entry.Path, "paths must be unique and sorted in byte order (after %q)", v.lastPath)
	}
	if err := v.checkFileDirConflict(entry.Path); err != nil {
		return err
	}

	v.totalBytes += entry.Size
	v.lastPath = entry.Path
	return nil
}

func (v *validator) checkFileDirConflict(p string) error {
	kept := v.pendingFiles[:0]
	for _, file := range v.pendingFiles {
		if strings.HasPrefix(p, file+"/") {
			return v.fail(p, "%q is both a file and a directory", file)
		}
		// '0' sorts right after '/', so no later path can start with file+"/".
		if p < file+"0" {
			kept = append(kept, file)
		}
	}

	v.pendingFiles = append(kept, p)
	return nil
}

func (v *validator) finish() error {
	if v.line == 0 {
		return &InvalidError{Ref: v.ref, Reason: "manifest is empty"}
	}
	if v.entries != v.header.EntryCount {
		return &InvalidError{Ref: v.ref, Reason: fmt.Sprintf("header entryCount is %d but the manifest has %d entries", v.header.EntryCount, v.entries)}
	}
	if v.totalBytes != v.header.TotalBytes {
		return &InvalidError{Ref: v.ref, Reason: fmt.Sprintf("header totalBytes is %d but entries add up to %d", v.header.TotalBytes, v.totalBytes)}
	}

	return nil
}

type Iterator struct {
	file    *os.File
	scanner *bufio.Scanner
	entry   Entry
	err     error
}

// Entries iterates the entries in path order. Callers must Close the iterator.
func (m *Manifest) Entries() (*Iterator, error) {
	if m.spoolPath == "" {
		return nil, errors.New("manifest is closed")
	}

	file, err := os.Open(m.spoolPath)
	if err != nil {
		return nil, err
	}

	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 64<<10), MaxLineBytes+1)
	if !scanner.Scan() {
		file.Close()
		return nil, fmt.Errorf("manifest spool is missing its header: %w", scanner.Err())
	}

	return &Iterator{file: file, scanner: scanner}, nil
}

func (it *Iterator) Next() bool {
	if it.err != nil || !it.scanner.Scan() {
		if it.err == nil {
			it.err = it.scanner.Err()
		}
		return false
	}

	var w wireEntry
	if err := json.Unmarshal(it.scanner.Bytes(), &w); err != nil {
		it.err = err
		return false
	}
	it.entry = Entry{Path: *w.P, GitBlobSHA: *w.G, SHA256: *w.S, Size: *w.N, CRC32: *w.C, Key: *w.K}
	return true
}

func (it *Iterator) Entry() Entry { return it.entry }

func (it *Iterator) Err() error { return it.err }

func (it *Iterator) Close() error { return it.file.Close() }

func (m *Manifest) Walk(ctx context.Context, fn func(Entry) error) error {
	it, err := m.Entries()
	if err != nil {
		return err
	}
	defer it.Close()

	for it.Next() {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := fn(it.Entry()); err != nil {
			return err
		}
	}

	return it.Err()
}
