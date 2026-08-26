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
	pointerVersion = "https://git-lfs.github.com/spec/v1"
	MaxPointerSize = 1024
)

type Pointer struct {
	OID  string
	Size int64
}

func FormatPointer(oid string, size int64) []byte {
	return []byte(fmt.Sprintf("version %s\noid sha256:%s\nsize %d\n", pointerVersion, oid, size))
}

func (p *Pointer) Bytes() []byte {
	return FormatPointer(p.OID, p.Size)
}

func OIDFor(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}

func OIDForReader(r io.Reader) (string, int64, error) {
	hasher := sha256.New()

	size, err := io.Copy(hasher, r)
	if err != nil {
		return "", 0, err
	}

	return hex.EncodeToString(hasher.Sum(nil)), size, nil
}

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
