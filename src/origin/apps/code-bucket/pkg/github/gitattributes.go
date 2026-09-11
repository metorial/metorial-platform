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

	entry := blobEntry(gitattributesPath, blobSHA)
	for i := range *treeEntries {
		if (*treeEntries)[i].Path == gitattributesPath {
			(*treeEntries)[i] = entry
			return nil
		}
	}
	*treeEntries = append(*treeEntries, entry)
	return nil
}

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
