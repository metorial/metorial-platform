package github

import (
	"context"
	"errors"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
)

func downloadOptionsFor(fake *fakeGitHub, path string) DownloadOptions {
	return DownloadOptions{
		Owner:   "o",
		Repo:    "r",
		Ref:     "main",
		Path:    path,
		Token:   "t",
		BaseURL: fake.server.URL,
	}
}

func TestDownloadRepoRejectsOversizedFilesBeforeFetchingTheZipball(t *testing.T) {
	fake := newFakeGitHub(t)
	fake.treeSizes["huge.bin"] = filelimit.MaxBufferedFileBytes + 1

	_, err := DownloadRepo(context.Background(), downloadOptionsFor(fake, ""))
	if !errors.Is(err, filelimit.ErrFileTooLarge) {
		t.Fatalf("expected the size sentinel, got %v", err)
	}

	fake.mu.Lock()
	requests := fake.zipballRequests
	fake.mu.Unlock()

	if requests != 0 {
		t.Fatalf("expected the archive download to be skipped, got %d requests", requests)
	}
}

func TestDownloadRepoIgnoresOversizedFilesOutsideTheImportedPath(t *testing.T) {
	fake := newFakeGitHub(t)
	fake.treeSizes["other/huge.bin"] = filelimit.MaxBufferedFileBytes + 1
	fake.treeSizes["wanted/small.txt"] = 4
	fake.zipball = buildZipball(t, map[string][]byte{"repo-main/wanted/small.txt": []byte("data")})

	iter, err := DownloadRepo(context.Background(), downloadOptionsFor(fake, "wanted"))
	if err != nil {
		t.Fatalf("expected the import to proceed, got %v", err)
	}
	defer iter.Close()
}

func TestDownloadRepoProceedsWhenTheTreeListingIsTruncated(t *testing.T) {
	fake := newFakeGitHub(t)
	fake.treeTruncated = true
	fake.treeSizes["huge.bin"] = filelimit.MaxBufferedFileBytes + 1
	fake.zipball = buildZipball(t, map[string][]byte{"repo-main/small.txt": []byte("data")})

	// A truncated listing cannot prove anything about the blobs it omitted, so
	// the import falls through to the extraction and iteration guards.
	iter, err := DownloadRepo(context.Background(), downloadOptionsFor(fake, ""))
	if err != nil {
		t.Fatalf("expected the import to proceed, got %v", err)
	}
	defer iter.Close()
}

func TestPathWithinImport(t *testing.T) {
	cases := []struct {
		entry  string
		target string
		want   bool
	}{
		{"a/b.txt", "", true},
		{"a/b.txt", "a", true},
		{"a/b.txt", "/a/", true},
		{"a/b.txt", "a/b.txt", true},
		{"ab/c.txt", "a", false},
		{"b/c.txt", "a", false},
	}

	for _, c := range cases {
		if got := pathWithinImport(c.entry, c.target); got != c.want {
			t.Errorf("pathWithinImport(%q, %q) = %v, want %v", c.entry, c.target, got, c.want)
		}
	}
}
