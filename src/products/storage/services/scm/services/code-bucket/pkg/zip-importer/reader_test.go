package zipImporter

import (
	"archive/zip"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
)

func buildZip(t *testing.T, entries map[string]int64) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "archive.zip")
	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("failed to create archive: %v", err)
	}
	defer file.Close()

	writer := zip.NewWriter(file)
	for name, size := range entries {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatalf("failed to create entry %s: %v", name, err)
		}
		if _, err := entry.Write(make([]byte, size)); err != nil {
			t.Fatalf("failed to write entry %s: %v", name, err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to finish archive: %v", err)
	}

	return path
}

func TestUnzipRejectsOversizedEntriesWithoutExtractingAnything(t *testing.T) {
	archive := buildZip(t, map[string]int64{
		"small.txt": 8,
		"huge.bin":  filelimit.MaxBufferedFileBytes + 1,
	})
	dest := t.TempDir()

	err := unzip(archive, dest)
	if !errors.Is(err, filelimit.ErrFileTooLarge) {
		t.Fatalf("expected the size sentinel, got %v", err)
	}

	extracted, err := os.ReadDir(dest)
	if err != nil {
		t.Fatalf("failed to read destination: %v", err)
	}
	if len(extracted) != 0 {
		t.Fatalf("expected nothing to be extracted, found %d entries", len(extracted))
	}
}

func TestUnzipExtractsEntriesWithinTheCeiling(t *testing.T) {
	archive := buildZip(t, map[string]int64{"small.txt": 8})
	dest := t.TempDir()

	if err := unzip(archive, dest); err != nil {
		t.Fatalf("expected extraction to succeed, got %v", err)
	}

	info, err := os.Stat(filepath.Join(dest, "small.txt"))
	if err != nil {
		t.Fatalf("expected the entry to be extracted: %v", err)
	}
	if info.Size() != 8 {
		t.Fatalf("expected 8 bytes, got %d", info.Size())
	}
}
