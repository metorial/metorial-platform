package zipImporter

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
)

// writeSparseFile produces a file of the given size without writing its bytes,
// so a test can exercise a size ceiling without paying for the data.
func writeSparseFile(t *testing.T, path string, size int64) {
	t.Helper()

	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("create %s: %v", path, err)
	}
	defer file.Close()

	if err := file.Truncate(size); err != nil {
		t.Fatalf("truncate %s: %v", path, err)
	}
}

func drain(it *ZipFileIterator) []string {
	paths := []string{}
	for {
		item, ok := it.Next()
		if !ok {
			return paths
		}
		paths = append(paths, item.Path)
	}
}

// The import path reads each entry whole, so an oversized entry has to be
// refused on its stat rather than pulled into memory first.
func TestNextRefusesEntriesTooLargeToBuffer(t *testing.T) {
	dir := t.TempDir()
	writeSparseFile(t, filepath.Join(dir, "huge.bin"), filelimit.MaxBufferedFileBytes+1)

	it := NewZipFileIterator(dir)
	defer it.Close()

	if paths := drain(it); len(paths) != 0 {
		t.Fatalf("expected no entries, got %#v", paths)
	}

	err := it.Err()
	if !errors.Is(err, filelimit.ErrFileTooLarge) {
		t.Fatalf("expected the entry to be refused on size, got %v", err)
	}
	if got := err.Error(); !strings.Contains(got, "huge.bin") {
		t.Fatalf("expected the error to name the entry, got %q", got)
	}
}

func TestNextYieldsEntriesWithinTheCeiling(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("plain text"), 0o600); err != nil {
		t.Fatalf("write file: %v", err)
	}

	it := NewZipFileIterator(dir)
	defer it.Close()

	paths := drain(it)
	if len(paths) != 1 || paths[0] != "notes.txt" {
		t.Fatalf("unexpected entries: %#v", paths)
	}
	if err := it.Err(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// An unreadable entry used to end the iteration silently, which imported a
// truncated repository as though it were complete.
func TestNextReportsUnreadableEntries(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "locked.bin")
	if err := os.WriteFile(path, []byte("secret"), 0o000); err != nil {
		t.Fatalf("write file: %v", err)
	}
	if os.Getuid() == 0 {
		t.Skip("root can read a mode 000 file")
	}

	it := NewZipFileIterator(dir)
	defer it.Close()

	if paths := drain(it); len(paths) != 0 {
		t.Fatalf("expected no entries, got %#v", paths)
	}
	if it.Err() == nil {
		t.Fatal("an unreadable entry ended the import without an error")
	}
}
