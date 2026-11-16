package util

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

var ErrPathOutsideRoot = errors.New("path is outside the repository")

// ResolveWithin joins a slash-separated relative path onto root and returns the
// result with every symlink resolved. It fails unless both the joined path and
// its resolved form stay inside root.
func ResolveWithin(root, relative string) (string, error) {
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", err
	}

	candidate := filepath.Join(resolvedRoot, filepath.FromSlash(relative))
	if !IsWithin(resolvedRoot, candidate) {
		return "", fmt.Errorf("%w: %q", ErrPathOutsideRoot, relative)
	}

	resolved, err := filepath.EvalSymlinks(candidate)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return "", fmt.Errorf("path %q does not exist in the repository", relative)
		}
		return "", err
	}
	if !IsWithin(resolvedRoot, resolved) {
		return "", fmt.Errorf("%w: %q", ErrPathOutsideRoot, relative)
	}

	return resolved, nil
}

// IsWithin reports whether candidate is root itself or lies beneath it. Both
// paths are compared lexically, so resolve symlinks first when that matters.
func IsWithin(root, candidate string) bool {
	relative, err := filepath.Rel(root, candidate)
	if err != nil {
		return false
	}

	return relative != ".." && !strings.HasPrefix(relative, ".."+string(os.PathSeparator))
}
