package bundle

import (
	"archive/tar"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
)

type Limits struct {
	MaxUnpackedBytes int64
	MaxEntries       int
	MaxPathLength    int
}

var DefaultLimits = Limits{
	MaxUnpackedBytes: 1 << 30,
	MaxEntries:       200_000,
	MaxPathLength:    1024,
}

type UnsafeArchiveError struct {
	Entry  string
	Reason string
}

func (e *UnsafeArchiveError) Error() string {
	return fmt.Sprintf("bundle: unsafe archive entry %q: %s", e.Entry, e.Reason)
}

type Stats struct {
	Entries       int
	UnpackedBytes int64
}

// Unpack extracts a tar stream into dir. Writes go through os.Root, so no entry can write
// outside dir even through symlinks created by earlier entries; a final pass rejects
// symlinks that resolve outside dir once the whole tree exists.
func Unpack(r io.Reader, dir string, limits Limits) (*Stats, error) {
	limits = withDefaults(limits)

	root, err := os.OpenRoot(dir)
	if err != nil {
		return nil, err
	}
	defer root.Close()

	stats := &Stats{}
	tr := tar.NewReader(r)
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return stats, fmt.Errorf("bundle: invalid archive: %w", err)
		}

		stats.Entries++
		if stats.Entries > limits.MaxEntries {
			return stats, &UnsafeArchiveError{Entry: hdr.Name, Reason: "too many entries"}
		}

		name, err := entryName(hdr.Name, limits)
		if err != nil {
			return stats, err
		}

		if err := extractEntry(root, tr, hdr, name, limits, stats); err != nil {
			return stats, err
		}
	}

	return stats, checkSymlinks(dir)
}

func extractEntry(root *os.Root, tr *tar.Reader, hdr *tar.Header, name string, limits Limits, stats *Stats) error {
	switch hdr.Typeflag {
	case tar.TypeDir:
		if name == "." {
			return nil
		}
		return root.MkdirAll(name, 0o755)

	case tar.TypeReg:
		if name == "." {
			return &UnsafeArchiveError{Entry: hdr.Name, Reason: "file at archive root"}
		}
		if hdr.Size < 0 || stats.UnpackedBytes+hdr.Size > limits.MaxUnpackedBytes {
			return &UnsafeArchiveError{Entry: hdr.Name, Reason: "archive exceeds the unpacked size limit"}
		}
		if err := mkdirParent(root, name); err != nil {
			return err
		}

		mode := os.FileMode(0o644)
		if hdr.Mode&0o111 != 0 {
			mode = 0o755
		}
		f, err := root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode)
		if err != nil {
			return err
		}
		written, err := io.Copy(f, io.LimitReader(tr, hdr.Size))
		closeErr := f.Close()
		if err != nil {
			return err
		}
		if closeErr != nil {
			return closeErr
		}
		if written != hdr.Size {
			return fmt.Errorf("bundle: truncated entry %q", hdr.Name)
		}
		stats.UnpackedBytes += written
		return nil

	case tar.TypeSymlink:
		if name == "." {
			return &UnsafeArchiveError{Entry: hdr.Name, Reason: "symlink at archive root"}
		}
		target := hdr.Linkname
		if target == "" || path.IsAbs(target) || strings.ContainsRune(target, 0) {
			return &UnsafeArchiveError{Entry: hdr.Name, Reason: "symlink target must be a relative path"}
		}
		if escapes(path.Join(path.Dir(name), target)) {
			return &UnsafeArchiveError{Entry: hdr.Name, Reason: "symlink points outside the bundle"}
		}
		if err := mkdirParent(root, name); err != nil {
			return err
		}
		return root.Symlink(target, name)

	case tar.TypeLink:
		target, err := entryName(hdr.Linkname, limits)
		if err != nil || target == "." || name == "." {
			return &UnsafeArchiveError{Entry: hdr.Name, Reason: "hard link outside the bundle"}
		}
		if err := mkdirParent(root, name); err != nil {
			return err
		}
		return root.Link(target, name)

	case tar.TypeXGlobalHeader:
		return nil

	default:
		return &UnsafeArchiveError{Entry: hdr.Name, Reason: fmt.Sprintf("unsupported entry type %q", hdr.Typeflag)}
	}
}

func entryName(raw string, limits Limits) (string, error) {
	if raw == "" || len(raw) > limits.MaxPathLength || strings.ContainsRune(raw, 0) {
		return "", &UnsafeArchiveError{Entry: raw, Reason: "invalid name"}
	}
	if path.IsAbs(raw) {
		return "", &UnsafeArchiveError{Entry: raw, Reason: "absolute path"}
	}
	for part := range strings.SplitSeq(raw, "/") {
		if part == ".." {
			return "", &UnsafeArchiveError{Entry: raw, Reason: "path traversal"}
		}
	}
	return path.Clean(raw), nil
}

func escapes(p string) bool {
	p = path.Clean(p)
	return p == ".." || strings.HasPrefix(p, "../") || path.IsAbs(p)
}

func mkdirParent(root *os.Root, name string) error {
	parent := path.Dir(name)
	if parent == "." {
		return nil
	}
	return root.MkdirAll(parent, 0o755)
}

// checkSymlinks resolves every symlink against the final tree. Lexical checks alone miss
// chains like p/d -> ../q followed by p/l -> d/../../x, and dangling links can't go through
// filepath.EvalSymlinks.
func checkSymlinks(dir string) error {
	return filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.Type()&fs.ModeSymlink == 0 {
			return nil
		}

		rel, _ := filepath.Rel(dir, p)
		if !resolvesInside(dir, filepath.ToSlash(rel)) {
			return &UnsafeArchiveError{Entry: rel, Reason: "symlink resolves outside the bundle"}
		}
		return nil
	})
}

// resolvesInside walks name one component at a time from dir, expanding symlinks the way
// the kernel would, and reports whether the walk ever leaves dir.
func resolvesInside(dir, name string) bool {
	pending := strings.Split(name, "/")
	var current []string

	for expansions := 0; len(pending) > 0; {
		part := pending[0]
		pending = pending[1:]

		switch part {
		case "", ".":
			continue
		case "..":
			if len(current) == 0 {
				return false
			}
			current = current[:len(current)-1]
			continue
		}

		candidate := filepath.Join(dir, filepath.Join(append(current, part)...))
		info, err := os.Lstat(candidate)
		if err != nil || info.Mode()&fs.ModeSymlink == 0 {
			current = append(current, part)
			continue
		}

		expansions++
		if expansions > 255 {
			return false
		}
		target, err := os.Readlink(candidate)
		if err != nil || filepath.IsAbs(target) {
			return false
		}
		pending = append(strings.Split(filepath.ToSlash(target), "/"), pending...)
	}
	return true
}

func withDefaults(l Limits) Limits {
	if l.MaxUnpackedBytes <= 0 {
		l.MaxUnpackedBytes = DefaultLimits.MaxUnpackedBytes
	}
	if l.MaxEntries <= 0 {
		l.MaxEntries = DefaultLimits.MaxEntries
	}
	if l.MaxPathLength <= 0 {
		l.MaxPathLength = DefaultLimits.MaxPathLength
	}
	return l
}

// Clear removes everything inside dir but keeps dir itself, which is an emptyDir mount.
func Clear(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if err := os.RemoveAll(filepath.Join(dir, entry.Name())); err != nil {
			return err
		}
	}
	return nil
}
