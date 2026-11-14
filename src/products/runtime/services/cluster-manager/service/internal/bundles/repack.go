package bundles

import (
	"archive/tar"
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/klauspost/compress/zstd"
)

type Limits struct {
	MaxZipBytes      int64
	MaxUnpackedBytes int64
	MaxEntries       int
}

type InvalidError struct {
	Reason string
}

func (e *InvalidError) Error() string {
	return "invalid bundle: " + e.Reason
}

func invalid(format string, args ...any) error {
	return &InvalidError{Reason: fmt.Sprintf(format, args...)}
}

type entry struct {
	name string
	file *zip.File
	dir  bool
	exec bool
}

var epoch = time.Unix(0, 0).UTC()

// Repack converts a zip archive into a deterministic tar.zst: entries sorted by path, fixed
// timestamps and owners, permissions reduced to 0644/0755. Anything that could escape the unpack
// root or that isn't a plain file or directory is rejected.
func Repack(r *zip.Reader, out io.Writer, limits Limits) (unpacked int64, err error) {
	entries, err := validate(r, limits)
	if err != nil {
		return 0, err
	}

	enc, err := zstd.NewWriter(out, zstd.WithEncoderConcurrency(1), zstd.WithEncoderLevel(zstd.SpeedDefault))
	if err != nil {
		return 0, err
	}
	tw := tar.NewWriter(enc)

	for _, e := range entries {
		if e.dir {
			err := tw.WriteHeader(&tar.Header{Typeflag: tar.TypeDir, Name: e.name + "/", Mode: 0o755, ModTime: epoch, Format: tar.FormatPAX})
			if err != nil {
				return 0, err
			}
			continue
		}

		mode := int64(0o644)
		if e.exec {
			mode = 0o755
		}
		size := int64(e.file.UncompressedSize64)
		if err := tw.WriteHeader(&tar.Header{Typeflag: tar.TypeReg, Name: e.name, Mode: mode, Size: size, ModTime: epoch, Format: tar.FormatPAX}); err != nil {
			return 0, err
		}
		if err := copyEntry(tw, e.file, size); err != nil {
			return 0, err
		}
		unpacked += size
	}

	if err := tw.Close(); err != nil {
		return 0, err
	}
	return unpacked, enc.Close()
}

func copyEntry(w io.Writer, f *zip.File, size int64) error {
	rc, err := f.Open()
	if err != nil {
		return invalid("cannot open %s: %v", f.Name, err)
	}
	defer rc.Close()

	src := &trackingReader{r: rc}
	if n, err := io.CopyN(w, src, size); err != nil {
		switch {
		case errors.Is(err, io.EOF):
			return invalid("%s is shorter than declared (%d of %d bytes)", f.Name, n, size)
		case src.err != nil:
			return invalid("%s is corrupt: %v", f.Name, err)
		default:
			return err
		}
	}

	// Reading to EOF makes archive/zip verify the CRC and the actual size.
	var probe [1]byte
	if n, err := rc.Read(probe[:]); n > 0 {
		return invalid("%s is larger than declared", f.Name)
	} else if err != nil && !errors.Is(err, io.EOF) {
		return invalid("%s is corrupt: %v", f.Name, err)
	}
	return nil
}

type trackingReader struct {
	r   io.Reader
	err error
}

func (t *trackingReader) Read(p []byte) (int, error) {
	n, err := t.r.Read(p)
	if err != nil && !errors.Is(err, io.EOF) {
		t.err = err
	}
	return n, err
}

func validate(r *zip.Reader, limits Limits) ([]entry, error) {
	if limits.MaxEntries > 0 && len(r.File) > limits.MaxEntries {
		return nil, invalid("archive has %d entries, more than the limit of %d", len(r.File), limits.MaxEntries)
	}

	byName := map[string]*entry{}
	var declared uint64

	for _, f := range r.File {
		name, err := cleanName(f.Name)
		if err != nil {
			return nil, err
		}
		if name == "" {
			continue
		}

		mode := f.Mode()
		isDir := mode.IsDir() || strings.HasSuffix(f.Name, "/")
		switch {
		case mode&fs.ModeSymlink != 0:
			return nil, invalid("%s is a symbolic link", f.Name)
		case !isDir && !mode.IsRegular():
			return nil, invalid("%s is not a regular file", f.Name)
		}

		if existing, ok := byName[name]; ok {
			if existing.dir && isDir {
				continue
			}
			return nil, invalid("%s appears more than once", name)
		}

		if !isDir {
			declared += f.UncompressedSize64
			if limits.MaxUnpackedBytes > 0 && declared > uint64(limits.MaxUnpackedBytes) {
				return nil, invalid("archive unpacks to more than %d bytes", limits.MaxUnpackedBytes)
			}
		}
		byName[name] = &entry{name: name, file: f, dir: isDir, exec: !isDir && mode.Perm()&0o111 != 0}
	}

	entries := make([]entry, 0, len(byName))
	for name, e := range byName {
		for parent := path.Dir(name); parent != "."; parent = path.Dir(parent) {
			if p, ok := byName[parent]; ok && !p.dir {
				return nil, invalid("%s is both a file and a directory", parent)
			}
		}
		entries = append(entries, *e)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].name < entries[j].name })
	return entries, nil
}

// cleanName returns the archive-relative path of an entry, or "" for the root itself.
func cleanName(raw string) (string, error) {
	switch {
	case raw == "":
		return "", invalid("entry with an empty name")
	case strings.ContainsRune(raw, 0):
		return "", invalid("entry name contains a NUL byte")
	case strings.Contains(raw, `\`):
		return "", invalid("%s uses backslashes in its path", raw)
	case strings.HasPrefix(raw, "/"):
		return "", invalid("%s is an absolute path", raw)
	}

	for segment := range strings.SplitSeq(strings.TrimSuffix(raw, "/"), "/") {
		if segment == ".." {
			return "", invalid("%s escapes the archive root", raw)
		}
	}

	name := path.Clean(raw)
	if name == "." {
		return "", nil
	}
	return name, nil
}
