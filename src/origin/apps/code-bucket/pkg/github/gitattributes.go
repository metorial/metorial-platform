package github

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

const (
	gitattributesPath = ".gitattributes"
	lfsAttributes     = "filter=lfs diff=lfs merge=lfs -text"
)

// trackLFSPaths makes sure every path stored in LFS has a matching
// .gitattributes entry, merging into whatever the repository already has rather
// than replacing it. Without this, clones get the pointer text instead of the
// file.
func trackLFSPaths(
	ctx context.Context,
	repoURL, token string,
	lfsPaths []string,
	exportedAttributes []byte,
	existingBlobShas map[string]string,
	treeEntries *[]githubTreeEntry,
) error {
	if len(lfsPaths) == 0 {
		return nil
	}

	// A .gitattributes coming from the bucket wins over the one on the branch,
	// since it is what this export is about to commit anyway.
	base := exportedAttributes
	if base == nil {
		if sha := existingBlobShas[gitattributesPath]; sha != "" {
			fetched, err := fetchBlobContent(ctx, repoURL, token, sha)
			if err != nil {
				return fmt.Errorf("failed to read existing %s: %w", gitattributesPath, err)
			}
			base = fetched
		}
	}

	merged := mergeGitattributes(base, lfsPaths)
	if bytes.Equal(merged, base) {
		return nil
	}

	blobSHA, err := createBlob(ctx, repoURL, token, merged)
	if err != nil {
		return fmt.Errorf("failed to create blob for %s: %w", gitattributesPath, err)
	}

	entry := githubTreeEntry{
		Path: gitattributesPath,
		Mode: "100644",
		Type: "blob",
		SHA:  blobSHA,
	}
	for i := range *treeEntries {
		if (*treeEntries)[i].Path == gitattributesPath {
			(*treeEntries)[i] = entry
			return nil
		}
	}
	*treeEntries = append(*treeEntries, entry)
	return nil
}

// mergeGitattributes appends one exact-path LFS rule per untracked path. Exact
// paths are used rather than guessed globs so the rules cannot pull unrelated
// files into LFS.
func mergeGitattributes(existing []byte, lfsPaths []string) []byte {
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
		lines = append(lines, pattern+" "+lfsAttributes)
	}

	if len(added) == 0 {
		return existing
	}
	return []byte(strings.Join(lines, "\n") + "\n")
}

// gitattributesPattern returns the pattern of an attribute line, skipping
// comments and blank lines.
func gitattributesPattern(line string) (string, bool) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" || strings.HasPrefix(trimmed, "#") {
		return "", false
	}

	if strings.HasPrefix(trimmed, `"`) {
		// Quoted patterns may contain escaped quotes, so scan to the closing one.
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

// quoteGitattributesPattern wraps a path in C-style quotes when it contains
// whitespace, which would otherwise be read as the start of the attribute list.
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

func fetchBlobContent(ctx context.Context, repoURL, token, sha string) ([]byte, error) {
	blob, err := githubJSON[githubBlobResponse](ctx, "GET", fmt.Sprintf("%s/git/blobs/%s", repoURL, sha), token, nil)
	if err != nil {
		return nil, err
	}

	switch blob.Encoding {
	case "base64", "":
		// GitHub wraps base64 blob content at 60 columns.
		cleaned := strings.NewReplacer("\n", "", "\r", "").Replace(blob.Content)
		return base64.StdEncoding.DecodeString(cleaned)
	case "utf-8":
		return []byte(blob.Content), nil
	default:
		return nil, fmt.Errorf("unsupported blob encoding %q", blob.Encoding)
	}
}

func humanBytes(size int64) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}
	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %ciB", float64(size)/float64(div), "KMGTPE"[exp])
}
