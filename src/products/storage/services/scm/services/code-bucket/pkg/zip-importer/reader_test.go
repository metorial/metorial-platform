package zipImporter

import (
	"archive/zip"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/egress"
	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/util"
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

func extractedRepo(t *testing.T) (tmpDir, extractDir, repoRoot string) {
	t.Helper()

	tmpDir = t.TempDir()
	extractDir = filepath.Join(tmpDir, "unzipped")
	repoRoot = filepath.Join(extractDir, "owner-repo-abc123")

	if err := os.MkdirAll(filepath.Join(repoRoot, "skills", "docs"), 0o755); err != nil {
		t.Fatalf("create repository: %v", err)
	}
	if err := os.WriteFile(filepath.Join(repoRoot, "skills", "docs", "guide.md"), []byte("guide"), 0o644); err != nil {
		t.Fatalf("write repository file: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "repo.zip"), []byte("archive"), 0o644); err != nil {
		t.Fatalf("write archive: %v", err)
	}

	return tmpDir, extractDir, repoRoot
}

func TestResolveImportRootAcceptsPathsInsideTheRepository(t *testing.T) {
	_, extractDir, repoRoot := extractedRepo(t)
	resolvedRepoRoot, err := filepath.EvalSymlinks(repoRoot)
	if err != nil {
		t.Fatalf("resolve repository root: %v", err)
	}

	for input, want := range map[string]string{
		"":                      resolvedRepoRoot,
		"/":                     resolvedRepoRoot,
		"/skills/docs":          filepath.Join(resolvedRepoRoot, "skills", "docs"),
		"skills/docs/guide.md":  filepath.Join(resolvedRepoRoot, "skills", "docs", "guide.md"),
		"skills/../skills/docs": filepath.Join(resolvedRepoRoot, "skills", "docs"),
	} {
		got, err := resolveImportRoot(extractDir, input)
		if err != nil {
			t.Fatalf("resolveImportRoot(%q) returned %v", input, err)
		}
		if got != want {
			t.Fatalf("resolveImportRoot(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestResolveImportRootRejectsPathsOutsideTheRepository(t *testing.T) {
	_, extractDir, _ := extractedRepo(t)

	for _, input := range []string{
		"..",
		"../..",
		"../../repo.zip",
		"../../../../../../../../proc/self/environ",
		"skills/../../../repo.zip",
	} {
		if _, err := resolveImportRoot(extractDir, input); !errors.Is(err, util.ErrPathOutsideRoot) {
			t.Fatalf("resolveImportRoot(%q) returned %v, want a path-outside-repository error", input, err)
		}
	}
}

func TestResolveImportRootRejectsSymlinksLeavingTheRepository(t *testing.T) {
	tmpDir, extractDir, repoRoot := extractedRepo(t)

	if err := os.Symlink(tmpDir, filepath.Join(repoRoot, "escape")); err != nil {
		t.Skipf("symlinks are unavailable: %v", err)
	}

	for _, input := range []string{"escape", "escape/repo.zip"} {
		if _, err := resolveImportRoot(extractDir, input); !errors.Is(err, util.ErrPathOutsideRoot) {
			t.Fatalf("resolveImportRoot(%q) returned %v, want a path-outside-repository error", input, err)
		}
	}
}

func TestResolveImportRootReportsMissingPaths(t *testing.T) {
	_, extractDir, _ := extractedRepo(t)

	if _, err := resolveImportRoot(extractDir, "missing/dir"); err == nil {
		t.Fatal("expected a missing import path to be reported")
	}
}

func TestIteratorOnlyRemovesItsOwnTempDir(t *testing.T) {
	parent := t.TempDir()
	tmpDir := filepath.Join(parent, "gh-zip-1")
	neighbour := filepath.Join(parent, "gh-zip-2")
	root := filepath.Join(tmpDir, "unzipped", "owner-repo-abc123", "skills")

	for _, dir := range []string{root, neighbour} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatalf("create %s: %v", dir, err)
		}
	}
	if err := os.WriteFile(filepath.Join(root, "guide.md"), []byte("guide"), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	it := newZipFileIterator(root, tmpDir)
	if paths := drain(it); len(paths) != 1 || paths[0] != "guide.md" {
		t.Fatalf("unexpected entries: %#v", paths)
	}
	if err := it.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}

	if _, err := os.Stat(tmpDir); !os.IsNotExist(err) {
		t.Fatalf("expected the whole temp dir to be removed, got %v", err)
	}
	if _, err := os.Stat(neighbour); err != nil {
		t.Fatalf("expected the neighbouring directory to survive: %v", err)
	}
}

func TestIteratorSkipsSymlinkedEntries(t *testing.T) {
	outside := t.TempDir()
	root := t.TempDir()

	if err := os.WriteFile(filepath.Join(outside, "secret.txt"), []byte("secret"), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "notes.txt"), []byte("notes"), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}
	if err := os.Symlink(filepath.Join(outside, "secret.txt"), filepath.Join(root, "link.txt")); err != nil {
		t.Skipf("symlinks are unavailable: %v", err)
	}

	it := NewZipFileIterator(root)
	defer it.Close()

	if paths := drain(it); len(paths) != 1 || paths[0] != "notes.txt" {
		t.Fatalf("unexpected entries: %#v", paths)
	}
}

func TestDownloadRefusesNonPublicAddresses(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("TMPDIR", tempDir)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("internal"))
	}))
	defer server.Close()

	_, err := DownloadZipContext(context.Background(), server.URL+"/archive.zip", "/", nil)
	if !errors.Is(err, egress.ErrAddressNotAllowed) {
		t.Fatalf("download returned %v, want the address to be refused", err)
	}

	leftovers, err := os.ReadDir(tempDir)
	if err != nil {
		t.Fatalf("read temp dir: %v", err)
	}
	if len(leftovers) != 0 {
		t.Fatalf("expected the failed download to leave nothing behind, found %d entries", len(leftovers))
	}
}
