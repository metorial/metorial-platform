package gitlfs

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"strconv"
	"strings"
)

const (
	// pointerVersion is the only spec version Git LFS has ever published.
	pointerVersion = "https://git-lfs.github.com/spec/v1"

	// MaxPointerSize bounds how much of a file is worth inspecting as a pointer.
	// The canonical form is around 130 bytes; the spec caps pointers at 1024.
	MaxPointerSize = 1024
)

// Pointer is the small text file Git LFS commits in place of the real content.
type Pointer struct {
	// OID is the lowercase hex sha256 digest of the content, without a prefix.
	OID  string
	Size int64
}

// FormatPointer renders the canonical pointer body: LF line endings, keys in
// alphabetical order after version, and a trailing newline.
func FormatPointer(oid string, size int64) []byte {
	return []byte(fmt.Sprintf("version %s\noid sha256:%s\nsize %d\n", pointerVersion, oid, size))
}

func (p *Pointer) Bytes() []byte {
	return FormatPointer(p.OID, p.Size)
}

// OIDFor returns the LFS object ID for content, which is its sha256 digest.
func OIDFor(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}

// OIDForReader computes the object ID by streaming, so a large file can be
// hashed without being held in memory. It also reports the number of bytes it
// read, which the caller needs for the pointer and for Content-Length.
func OIDForReader(r io.Reader) (string, int64, error) {
	hasher := sha256.New()

	size, err := io.Copy(hasher, r)
	if err != nil {
		return "", 0, err
	}

	return hex.EncodeToString(hasher.Sum(nil)), size, nil
}

// ParsePointer reports whether content is a Git LFS pointer and, if so, what it
// points at. Anything that does not parse cleanly is treated as regular content.
func ParsePointer(content []byte) (*Pointer, bool) {
	if len(content) == 0 || len(content) > MaxPointerSize {
		return nil, false
	}

	fields := map[string]string{}
	var order []string
	for _, line := range strings.Split(strings.TrimRight(string(content), "\n"), "\n") {
		if line == "" {
			return nil, false
		}
		key, value, found := strings.Cut(line, " ")
		if !found || key == "" || value == "" {
			return nil, false
		}
		if _, duplicate := fields[key]; duplicate {
			return nil, false
		}
		fields[key] = value
		order = append(order, key)
	}

	// The version line has to come first, which is what makes a cheap prefix
	// check enough to rule out ordinary files.
	if len(order) < 3 || order[0] != "version" || fields["version"] != pointerVersion {
		return nil, false
	}

	oid, ok := strings.CutPrefix(fields["oid"], "sha256:")
	if !ok || !isHex256(oid) {
		return nil, false
	}

	size, err := strconv.ParseInt(fields["size"], 10, 64)
	if err != nil || size < 0 {
		return nil, false
	}

	return &Pointer{OID: oid, Size: size}, true
}

// LooksLikePointer is a cheap prefilter for callers streaming many files that
// want to skip the full parse for obviously-regular content.
func LooksLikePointer(content []byte) bool {
	return len(content) <= MaxPointerSize && strings.HasPrefix(string(content), "version "+pointerVersion+"\n")
}

func isHex256(s string) bool {
	if len(s) != 64 {
		return false
	}
	_, err := hex.DecodeString(s)
	return err == nil
}
