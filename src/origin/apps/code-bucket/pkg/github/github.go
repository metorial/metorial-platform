package github

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
)

const (
	// DefaultBaseURL is the REST API root for github.com.
	DefaultBaseURL = "https://api.github.com"

	// DefaultLFSThresholdBytes is the size at which a file is routed through Git
	// LFS instead of the blobs API. The blobs API takes base64 inside a JSON body
	// and starts answering 422 "input was too large to process" well below its
	// documented 100MB ceiling.
	DefaultLFSThresholdBytes int64 = 40 << 20

	// DefaultMaxFileBytes is the largest single file the exporter accepts. File
	// contents are held fully in memory, so this has to stay within the service
	// memory limit.
	DefaultMaxFileBytes int64 = 100 << 20

	apiTimeout      = 2 * time.Minute
	transferTimeout = 30 * time.Minute
)

var (
	apiClient      = &http.Client{Timeout: apiTimeout}
	transferClient = &http.Client{Timeout: transferTimeout}
)

// DefaultLFSEndpoint returns the Git LFS server for a github.com repository.
// Note that LFS lives on github.com, not on api.github.com.
func DefaultLFSEndpoint(owner, repo string) string {
	return fmt.Sprintf("https://github.com/%s/%s.git/info/lfs", owner, repo)
}

type UploadOptions struct {
	Owner         string
	Repo          string
	TargetPath    string
	Branch        string
	CommitMessage string
	Token         string

	// BaseURL overrides the REST API root. Empty means github.com.
	BaseURL string
	// LFSEndpoint overrides the Git LFS server. Empty derives it from the repo.
	LFSEndpoint string

	// LFSThresholdBytes routes files of at least this size through Git LFS.
	LFSThresholdBytes int64
	// MaxFileBytes rejects files larger than this outright.
	MaxFileBytes int64
}

func (o UploadOptions) withDefaults() UploadOptions {
	o.BaseURL = normalizeBaseURL(o.BaseURL)
	if o.LFSEndpoint == "" {
		o.LFSEndpoint = DefaultLFSEndpoint(o.Owner, o.Repo)
	}
	o.LFSEndpoint = strings.TrimSuffix(o.LFSEndpoint, "/")
	if o.Branch == "" {
		o.Branch = "main"
	}
	if o.CommitMessage == "" {
		o.CommitMessage = "Upload files"
	}
	if o.LFSThresholdBytes <= 0 {
		o.LFSThresholdBytes = DefaultLFSThresholdBytes
	}
	if o.MaxFileBytes <= 0 {
		o.MaxFileBytes = DefaultMaxFileBytes
	}
	return o
}

type DownloadOptions struct {
	Owner string
	Repo  string
	Path  string
	Ref   string
	Token string

	// BaseURL overrides the REST API root. Empty means github.com.
	BaseURL string
	// LFSEndpoint overrides the Git LFS server. Empty derives it from the repo.
	LFSEndpoint string
}

func (o DownloadOptions) withDefaults() DownloadOptions {
	o.BaseURL = normalizeBaseURL(o.BaseURL)
	if o.LFSEndpoint == "" {
		o.LFSEndpoint = DefaultLFSEndpoint(o.Owner, o.Repo)
	}
	o.LFSEndpoint = strings.TrimSuffix(o.LFSEndpoint, "/")
	return o
}

func normalizeBaseURL(baseURL string) string {
	if baseURL == "" {
		return DefaultBaseURL
	}
	return strings.TrimSuffix(baseURL, "/")
}

type FileToUpload struct {
	Path    string
	Content []byte
}

type FileIterator func(func(FileToUpload) error) error

type githubRefResponse struct {
	Object struct {
		SHA string `json:"sha"`
	} `json:"object"`
}

type githubCommitResponse struct {
	SHA  string `json:"sha"`
	Tree struct {
		SHA string `json:"sha"`
	} `json:"tree"`
}

type githubTreeResponse struct {
	Tree []struct {
		Path string `json:"path"`
		Type string `json:"type"`
		SHA  string `json:"sha"`
	} `json:"tree"`
}

type githubCreateBlobRequest struct {
	Content  string `json:"content"`
	Encoding string `json:"encoding"`
}

type githubCreateBlobResponse struct {
	SHA string `json:"sha"`
}

type githubBlobResponse struct {
	Content  string `json:"content"`
	Encoding string `json:"encoding"`
}

type githubTreeEntry struct {
	Path string `json:"path"`
	Mode string `json:"mode"`
	Type string `json:"type"`
	SHA  string `json:"sha"`
}

type githubCreateTreeRequest struct {
	BaseTree string            `json:"base_tree"`
	Tree     []githubTreeEntry `json:"tree"`
}

type githubCreateTreeResponse struct {
	SHA string `json:"sha"`
}

type githubCreateCommitRequest struct {
	Message string   `json:"message"`
	Tree    string   `json:"tree"`
	Parents []string `json:"parents"`
}

type githubCreateCommitResponse struct {
	SHA string `json:"sha"`
}

type githubUpdateRefRequest struct {
	SHA   string `json:"sha"`
	Force bool   `json:"force"`
}

func UploadToRepo(ctx context.Context, opts UploadOptions, files []FileToUpload) error {
	return UploadToRepoIter(ctx, opts, func(yield func(FileToUpload) error) error {
		for _, file := range files {
			if err := yield(file); err != nil {
				return err
			}
		}
		return nil
	})
}

func UploadToRepoIter(ctx context.Context, opts UploadOptions, iter FileIterator) error {
	if opts.Token == "" {
		return fmt.Errorf("GitHub token is required")
	}
	opts = opts.withDefaults()

	repoURL := fmt.Sprintf("%s/repos/%s/%s", opts.BaseURL, opts.Owner, opts.Repo)

	ref, err := githubJSON[githubRefResponse](ctx, "GET", fmt.Sprintf("%s/git/ref/heads/%s", repoURL, opts.Branch), opts.Token, nil)
	if err != nil {
		return fmt.Errorf("failed to get branch ref %s: %w", opts.Branch, err)
	}

	baseCommit, err := githubJSON[githubCommitResponse](ctx, "GET", fmt.Sprintf("%s/git/commits/%s", repoURL, ref.Object.SHA), opts.Token, nil)
	if err != nil {
		return fmt.Errorf("failed to get base commit %s: %w", ref.Object.SHA, err)
	}

	baseTree, err := githubJSON[githubTreeResponse](ctx, "GET", fmt.Sprintf("%s/git/trees/%s?recursive=1", repoURL, baseCommit.Tree.SHA), opts.Token, nil)
	if err != nil {
		return fmt.Errorf("failed to get base tree %s: %w", baseCommit.Tree.SHA, err)
	}

	existingBlobShas := map[string]string{}
	for _, entry := range baseTree.Tree {
		if entry.Type == "blob" {
			existingBlobShas[entry.Path] = entry.SHA
		}
	}

	lfs := gitlfs.NewClient(opts.LFSEndpoint, "", opts.Token, transferClient)
	lfsRef := "refs/heads/" + opts.Branch

	treeEntries := make([]githubTreeEntry, 0)
	lfsPaths := make([]string, 0)
	var exportedAttributes []byte

	if err := iter(func(file FileToUpload) error {
		if err := ctx.Err(); err != nil {
			return err
		}

		// Normalize the path by joining targetPath with file.Path
		fullPath := path.Join(opts.TargetPath, file.Path)
		// Clean up any double slashes or leading slashes
		fullPath = strings.TrimPrefix(fullPath, "/")

		size := int64(len(file.Content))
		if size > opts.MaxFileBytes {
			return fmt.Errorf(
				"file %s is %s, which exceeds the %s per-file limit for GitHub export",
				fullPath, humanBytes(size), humanBytes(opts.MaxFileBytes),
			)
		}

		// Above the threshold the content goes to LFS storage and only a ~130
		// byte pointer is committed, keeping the oversized payload away from the
		// blobs API, which answers 422 for bodies this large.
		content := file.Content
		var oid string
		useLFS := size >= opts.LFSThresholdBytes
		if useLFS {
			oid = gitlfs.OIDFor(file.Content)
			content = gitlfs.FormatPointer(oid, size)
			lfsPaths = append(lfsPaths, fullPath)
		}

		if fullPath == gitattributesPath {
			exportedAttributes = file.Content
		}

		// Dedupe against what the branch already has. For LFS files this compares
		// pointer against pointer; comparing raw content would re-upload every
		// large file on every export.
		if existingBlobShas[fullPath] == gitBlobSHA(content) {
			return nil
		}

		if useLFS {
			if err := lfs.Upload(ctx, lfsRef, oid, size, file.Content); err != nil {
				return fmt.Errorf("failed to upload %s (%s) to Git LFS: %w", fullPath, humanBytes(size), err)
			}
		}

		blobSHA, err := createBlob(ctx, repoURL, opts.Token, content)
		if err != nil {
			return fmt.Errorf("failed to create blob for %s: %w", fullPath, err)
		}

		treeEntries = append(treeEntries, githubTreeEntry{
			Path: fullPath,
			Mode: "100644",
			Type: "blob",
			SHA:  blobSHA,
		})
		return nil
	}); err != nil {
		return err
	}

	if err := trackLFSPaths(ctx, repoURL, opts.Token, lfsPaths, exportedAttributes, existingBlobShas, &treeEntries); err != nil {
		return err
	}

	if len(treeEntries) == 0 {
		return nil
	}

	newTree, err := githubJSON[githubCreateTreeResponse](
		ctx,
		"POST",
		fmt.Sprintf("%s/git/trees", repoURL),
		opts.Token,
		githubCreateTreeRequest{
			BaseTree: baseCommit.Tree.SHA,
			Tree:     treeEntries,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to create tree: %w", err)
	}

	newCommit, err := githubJSON[githubCreateCommitResponse](
		ctx,
		"POST",
		fmt.Sprintf("%s/git/commits", repoURL),
		opts.Token,
		githubCreateCommitRequest{
			Message: opts.CommitMessage,
			Tree:    newTree.SHA,
			Parents: []string{baseCommit.SHA},
		},
	)
	if err != nil {
		return fmt.Errorf("failed to create commit: %w", err)
	}

	_, err = githubJSON[githubRefResponse](
		ctx,
		"PATCH",
		fmt.Sprintf("%s/git/refs/heads/%s", repoURL, opts.Branch),
		opts.Token,
		githubUpdateRefRequest{
			SHA:   newCommit.SHA,
			Force: false,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to update branch ref %s: %w", opts.Branch, err)
	}

	return nil
}

func createBlob(ctx context.Context, repoURL, token string, content []byte) (string, error) {
	blob, err := githubJSON[githubCreateBlobResponse](
		ctx,
		"POST",
		fmt.Sprintf("%s/git/blobs", repoURL),
		token,
		githubCreateBlobRequest{
			Content:  base64.StdEncoding.EncodeToString(content),
			Encoding: "base64",
		},
	)
	if err != nil {
		return "", err
	}
	return blob.SHA, nil
}

func gitBlobSHA(content []byte) string {
	h := sha1.New()
	_, _ = h.Write([]byte(fmt.Sprintf("blob %d\x00", len(content))))
	_, _ = h.Write(content)
	return hex.EncodeToString(h.Sum(nil))
}

func githubJSON[T any](ctx context.Context, method, url, token string, body any) (*T, error) {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		reader = bytes.NewBuffer(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := apiClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("%s %s failed (status %d): %s", method, url, resp.StatusCode, string(respBody))
	}

	var out T
	if len(respBody) == 0 {
		return &out, nil
	}
	if err := json.Unmarshal(respBody, &out); err != nil {
		return nil, err
	}

	return &out, nil
}
