package export

import (
	"strconv"
	"strings"
	"unicode"
)

const (
	GitattributesPath = ".gitattributes"
	LFSAttributes     = "filter=lfs diff=lfs merge=lfs -text"
)

// MergeGitattributes appends an LFS rule for every path that no existing rule names
// exactly. It returns existing unchanged (same slice) when nothing had to be added.
func MergeGitattributes(existing []byte, lfsPaths []string) []byte {
	var lines []string
	if len(existing) > 0 {
		lines = strings.Split(strings.TrimRight(string(existing), "\n"), "\n")
	}

	tracked := make(map[string]bool, len(lines))
	for _, line := range lines {
		if pattern, ok := gitattributesPattern(line); ok {
			tracked[pattern] = true
		}
	}

	added := make(map[string]bool, len(lfsPaths))
	for _, lfsPath := range lfsPaths {
		pattern := quoteGitattributesPattern(lfsPath)
		if tracked[pattern] || added[pattern] {
			continue
		}
		added[pattern] = true
		lines = append(lines, pattern+" "+LFSAttributes)
	}

	if len(added) == 0 {
		return existing
	}
	return []byte(strings.Join(lines, "\n") + "\n")
}

func gitattributesPattern(line string) (string, bool) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" || strings.HasPrefix(trimmed, "#") {
		return "", false
	}

	if strings.HasPrefix(trimmed, `"`) {
		for i := 1; i < len(trimmed); i++ {
			if trimmed[i] == '\\' {
				i++
				continue
			}
			if trimmed[i] == '"' {
				return trimmed[:i+1], true
			}
		}
		return "", false
	}

	pattern, _, _ := strings.Cut(trimmed, " ")
	pattern, _, _ = strings.Cut(pattern, "\t")
	return pattern, pattern != ""
}

func quoteGitattributesPattern(path string) string {
	needsQuoting := strings.ContainsAny(path, `"\`)
	if !needsQuoting {
		needsQuoting = strings.IndexFunc(path, unicode.IsSpace) >= 0
	}
	if !needsQuoting {
		return path
	}
	return strconv.Quote(path)
}
