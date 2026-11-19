package util

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func repositoryFixture(t *testing.T) (root, outside string) {
	t.Helper()

	parent, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatalf("resolve temp dir: %v", err)
	}
	root = filepath.Join(parent, "repo")
	outside = filepath.Join(parent, "outside")

	for _, dir := range []string{filepath.Join(root, "skills", "docs"), outside} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatalf("create %s: %v", dir, err)
		}
	}
	for _, file := range []string{filepath.Join(root, "skills", "docs", "guide.md"), filepath.Join(outside, "secret.txt")} {
		if err := os.WriteFile(file, []byte("content"), 0o644); err != nil {
			t.Fatalf("write %s: %v", file, err)
		}
	}

	return root, outside
}

func TestResolveWithinAcceptsPathsInsideTheRoot(t *testing.T) {
	root, _ := repositoryFixture(t)

	for input, want := range map[string]string{
		"":                          root,
		"/":                         root,
		".":                         root,
		"skills":                    filepath.Join(root, "skills"),
		"/skills/docs/":             filepath.Join(root, "skills", "docs"),
		"skills/./docs/../docs":     filepath.Join(root, "skills", "docs"),
		"/skills/docs/guide.md":     filepath.Join(root, "skills", "docs", "guide.md"),
		"skills/docs/../../skills/": filepath.Join(root, "skills"),
	} {
		got, err := ResolveWithin(root, input)
		if err != nil {
			t.Fatalf("ResolveWithin(%q) returned %v", input, err)
		}
		if got != want {
			t.Fatalf("ResolveWithin(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestResolveWithinRejectsPathsOutsideTheRoot(t *testing.T) {
	root, _ := repositoryFixture(t)

	for _, input := range []string{
		"..",
		"../outside",
		"../outside/secret.txt",
		"/../outside",
		"skills/../../outside/secret.txt",
		"../../../../../../../../etc/passwd",
		"../repo-sibling",
	} {
		if _, err := ResolveWithin(root, input); !errors.Is(err, ErrPathOutsideRoot) {
			t.Fatalf("ResolveWithin(%q) returned %v, want ErrPathOutsideRoot", input, err)
		}
	}
}

func TestResolveWithinRejectsSymlinksLeavingTheRoot(t *testing.T) {
	root, outside := repositoryFixture(t)

	if err := os.Symlink(outside, filepath.Join(root, "escape")); err != nil {
		t.Skipf("symlinks are unavailable: %v", err)
	}
	if err := os.Symlink(filepath.Join("..", "..", "outside", "secret.txt"), filepath.Join(root, "skills", "file-escape")); err != nil {
		t.Fatalf("create symlink: %v", err)
	}

	for _, input := range []string{"escape", "escape/secret.txt", "skills/file-escape"} {
		if _, err := ResolveWithin(root, input); !errors.Is(err, ErrPathOutsideRoot) {
			t.Fatalf("ResolveWithin(%q) returned %v, want ErrPathOutsideRoot", input, err)
		}
	}
}

func TestResolveWithinFollowsSymlinksThatStayInsideTheRoot(t *testing.T) {
	root, _ := repositoryFixture(t)

	if err := os.Symlink(filepath.Join("skills", "docs"), filepath.Join(root, "docs")); err != nil {
		t.Skipf("symlinks are unavailable: %v", err)
	}

	got, err := ResolveWithin(root, "docs/guide.md")
	if err != nil {
		t.Fatalf("ResolveWithin returned %v", err)
	}
	if want := filepath.Join(root, "skills", "docs", "guide.md"); got != want {
		t.Fatalf("ResolveWithin = %q, want %q", got, want)
	}
}

func TestResolveWithinResolvesASymlinkedRoot(t *testing.T) {
	root, _ := repositoryFixture(t)
	alias := filepath.Join(filepath.Dir(root), "alias")

	if err := os.Symlink(root, alias); err != nil {
		t.Skipf("symlinks are unavailable: %v", err)
	}

	got, err := ResolveWithin(alias, "skills")
	if err != nil {
		t.Fatalf("ResolveWithin returned %v", err)
	}
	if want := filepath.Join(root, "skills"); got != want {
		t.Fatalf("ResolveWithin = %q, want %q", got, want)
	}
}

func TestResolveWithinReportsMissingPaths(t *testing.T) {
	root, _ := repositoryFixture(t)

	_, err := ResolveWithin(root, "skills/missing")
	if err == nil || errors.Is(err, ErrPathOutsideRoot) {
		t.Fatalf("expected a missing-path error, got %v", err)
	}
}
