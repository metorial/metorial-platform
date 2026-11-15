package github

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/metorial/metorial/services/code-bucket/pkg/export"
)

const (
	gitattributesPath = export.GitattributesPath
	lfsAttributes     = export.LFSAttributes
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

	merged := export.MergeGitattributes(base, lfsPaths)
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
