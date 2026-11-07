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
	"log"
	"net/http"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/gitlfs"
	"github.com/metorial/metorial/services/code-bucket/pkg/util"
)

const (
	DefaultBaseURL = "https://api.github.com"

	DefaultLFSThresholdBytes int64 = 8 << 20

	DefaultMaxFileBytes int64 = 2 << 30

	maxGitattributesBytes int64 = 1 << 20

	maxInlineContentBytes   = 1 << 20
	maxTreeBatchEntries     = 500
	maxTreeBatchInlineBytes = 10 << 20

	apiTimeout      = 2 * time.Minute
	transferTimeout = 30 * time.Minute
)

const (
	maxRequestAttempts  = 8
	maxRetryDelay       = 5 * time.Minute
	minRateLimitBackoff = time.Minute
	blobCreateInterval  = 800 * time.Millisecond
)

var (
	apiClient      = &http.Client{Timeout: apiTimeout}
	transferClient = &http.Client{Timeout: transferTimeout}

	sleepFn = sleepContext

	blobPaceMu   sync.Mutex
	blobPaceNext time.Time
)

func sleepContext(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

func paceBlobCreation(ctx context.Context) error {
	blobPaceMu.Lock()
	now := time.Now()
	wait := blobPaceNext.Sub(now)
	if wait < 0 {
		wait = 0
		blobPaceNext = now.Add(blobCreateInterval)
	} else {
		blobPaceNext = blobPaceNext.Add(blobCreateInterval)
	}
	blobPaceMu.Unlock()

	if wait == 0 {
		return nil
	}
	return sleepFn(ctx, wait)
}

func isRateLimited(status int, body []byte) bool {
	if status == http.StatusTooManyRequests {
		return true
	}
	return status == http.StatusForbidden &&
		strings.Contains(strings.ToLower(string(body)), "rate limit")
}

func isRetryableStatus(status int, body []byte) bool {
	return status >= http.StatusInternalServerError || isRateLimited(status, body)
}

func retryDelay(resp *http.Response, body []byte, attempt int) time.Duration {
	var delay time.Duration

	if seconds, err := strconv.Atoi(resp.Header.Get("Retry-After")); err == nil && seconds > 0 {
		delay = time.Duration(seconds) * time.Second
	} else if resp.Header.Get("X-RateLimit-Remaining") == "0" {
		if reset, err := strconv.ParseInt(resp.Header.Get("X-RateLimit-Reset"), 10, 64); err == nil {
			delay = time.Until(time.Unix(reset, 0)) + time.Second
		}
	}

	if delay <= 0 {
		if isRateLimited(resp.StatusCode, body) {
			delay = minRateLimitBackoff * time.Duration(attempt)
		} else {
			delay = time.Second * time.Duration(1<<(attempt-1))
		}
	}

	if isRateLimited(resp.StatusCode, body) && delay < minRateLimitBackoff {
		delay = minRateLimitBackoff
	}
	if delay > maxRetryDelay {
		delay = maxRetryDelay
	}
	return delay
}

func DefaultLFSEndpoint(owner, repo string) string {
	return fmt.Sprintf("https://github.com/%s/%s.git/info/lfs", owner, repo)
}

type UploadOptions struct {
	Owner             string
	Repo              string
	TargetPath        string
	Branch            string
	CommitMessage     string
	Token             string
	DeletePaths       []string
	BaseURL           string
	LFSEndpoint       string
	LFSThresholdBytes int64
	MaxFileBytes      int64
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

	BaseURL     string
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
	Path string
	Size int64
	Open gitlfs.ContentOpener
}

func ContentFile(path string, content []byte) FileToUpload {
	return FileToUpload{
		Path: path,
		Size: int64(len(content)),
		Open: gitlfs.OpenerForBytes(content),
	}
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
		Size int64  `json:"size"`
	} `json:"tree"`

	Truncated bool `json:"truncated"`
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
	Path    string  `json:"path"`
	Mode    string  `json:"mode"`
	Type    string  `json:"type"`
	SHA     *string `json:"sha"`
	Content *string `json:"content,omitempty"`
}

func inlineEntry(path string, content []byte) githubTreeEntry {
	text := string(content)
	return githubTreeEntry{Path: path, Mode: "100644", Type: "blob", Content: &text}
}

func canInline(content []byte) bool {
	return len(content) > 0 &&
		len(content) <= maxInlineContentBytes &&
		utf8.Valid(content) &&
		bytes.IndexByte(content, 0) < 0
}

func (e githubTreeEntry) MarshalJSON() ([]byte, error) {
	if e.Content != nil {
		return json.Marshal(struct {
			Path    string `json:"path"`
			Mode    string `json:"mode"`
			Type    string `json:"type"`
			Content string `json:"content"`
		}{e.Path, e.Mode, e.Type, *e.Content})
	}
	return json.Marshal(struct {
		Path string  `json:"path"`
		Mode string  `json:"mode"`
		Type string  `json:"type"`
		SHA  *string `json:"sha"`
	}{e.Path, e.Mode, e.Type, e.SHA})
}

func blobEntry(path, sha string) githubTreeEntry {
	return githubTreeEntry{Path: path, Mode: "100644", Type: "blob", SHA: &sha}
}

func deleteEntry(path string) githubTreeEntry {
	return githubTreeEntry{Path: path, Mode: "100644", Type: "blob", SHA: nil}
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

func openAndRead(file FileToUpload) ([]byte, error) {
	body, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer body.Close()

	return io.ReadAll(body)
}

func openAndHash(file FileToUpload) (string, int64, error) {
	body, err := file.Open()
	if err != nil {
		return "", 0, err
	}
	defer body.Close()

	return gitlfs.OIDForReader(body)
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
	currentTreeSHA := baseCommit.Tree.SHA
	pendingInlineBytes := 0
	flushedTrees := 0

	flushTree := func() error {
		if len(treeEntries) == 0 {
			return nil
		}

		newTree, err := githubJSON[githubCreateTreeResponse](
			ctx,
			"POST",
			fmt.Sprintf("%s/git/trees", repoURL),
			opts.Token,
			githubCreateTreeRequest{
				BaseTree: currentTreeSHA,
				Tree:     treeEntries,
			},
		)
		if err != nil {
			return fmt.Errorf("failed to create tree: %w", err)
		}

		currentTreeSHA = newTree.SHA
		treeEntries = treeEntries[:0]
		pendingInlineBytes = 0
		flushedTrees++
		return nil
	}

	lfsPaths := make([]string, 0)
	var exportedAttributes []byte

	writtenPaths := map[string]struct{}{}

	if err := iter(func(file FileToUpload) error {
		if err := ctx.Err(); err != nil {
			return err
		}

		fullPath := path.Join(opts.TargetPath, file.Path)
		fullPath = strings.TrimPrefix(fullPath, "/")
		writtenPaths[fullPath] = struct{}{}

		size := file.Size

		useLFS := size >= opts.LFSThresholdBytes && fullPath != gitattributesPath

		limit := opts.MaxFileBytes
		if fullPath == gitattributesPath {
			limit = maxGitattributesBytes
		}

		if size > limit {
			log.Printf(
				"[github export] rejected repo=%s/%s branch=%s path=%s size=%d limit=%d",
				opts.Owner, opts.Repo, opts.Branch, fullPath, size, limit,
			)
			return filelimit.FileTooLargeError("GitHub export", fullPath, size, limit)
		}

		log.Printf(
			"[github export] file repo=%s/%s branch=%s path=%s size=%d route=%s",
			opts.Owner, opts.Repo, opts.Branch, fullPath, size,
			util.Ternary(useLFS, "lfs", "blob"),
		)

		var content []byte
		var oid string

		if useLFS {
			hashed, hashedSize, err := openAndHash(file)
			if err != nil {
				return fmt.Errorf("failed to read %s: %w", fullPath, err)
			}
			if hashedSize != size {
				return fmt.Errorf(
					"file %s changed while exporting: listed as %s, read %s",
					fullPath, filelimit.HumanBytes(size), filelimit.HumanBytes(hashedSize),
				)
			}

			oid = hashed
			content = gitlfs.FormatPointer(oid, size)
			lfsPaths = append(lfsPaths, fullPath)
		} else {
			var err error
			content, err = openAndRead(file)
			if err != nil {
				return fmt.Errorf("failed to read %s: %w", fullPath, err)
			}
		}

		if fullPath == gitattributesPath {
			exportedAttributes = content
		}

		if existingBlobShas[fullPath] == gitBlobSHA(content) {
			return nil
		}

		if useLFS {
			started := time.Now()
			log.Printf(
				"[github export] lfs upload start repo=%s/%s path=%s size=%d oid=%s",
				opts.Owner, opts.Repo, fullPath, size, oid,
			)

			if err := lfs.Upload(ctx, lfsRef, oid, size, file.Open); err != nil {
				log.Printf(
					"[github export] lfs upload failed repo=%s/%s path=%s size=%d oid=%s took=%s err=%v",
					opts.Owner, opts.Repo, fullPath, size, oid, time.Since(started), err,
				)
				return fmt.Errorf(
					"failed to upload %s (%s) to Git LFS: %w",
					fullPath, filelimit.HumanBytes(size), err,
				)
			}

			log.Printf(
				"[github export] lfs upload done repo=%s/%s path=%s size=%d oid=%s took=%s",
				opts.Owner, opts.Repo, fullPath, size, oid, time.Since(started),
			)
		}

		if canInline(content) {
			treeEntries = append(treeEntries, inlineEntry(fullPath, content))
			pendingInlineBytes += len(content)
		} else {
			blobSHA, err := createBlob(ctx, repoURL, opts.Token, content)
			if err != nil {
				return fmt.Errorf("failed to create blob for %s: %w", fullPath, err)
			}

			treeEntries = append(treeEntries, blobEntry(fullPath, blobSHA))
		}

		if len(treeEntries) >= maxTreeBatchEntries || pendingInlineBytes >= maxTreeBatchInlineBytes {
			return flushTree()
		}
		return nil
	}); err != nil {
		return err
	}

	if err := trackLFSPaths(ctx, repoURL, opts.Token, lfsPaths, exportedAttributes, existingBlobShas, &treeEntries); err != nil {
		return err
	}

	for _, deletePath := range opts.DeletePaths {
		fullPath := strings.TrimPrefix(path.Join(opts.TargetPath, deletePath), "/")

		if _, written := writtenPaths[fullPath]; written {
			continue
		}
		if _, exists := existingBlobShas[fullPath]; !exists {
			continue
		}

		log.Printf(
			"[github export] delete repo=%s/%s branch=%s path=%s",
			opts.Owner, opts.Repo, opts.Branch, fullPath,
		)
		treeEntries = append(treeEntries, deleteEntry(fullPath))
	}

	if len(treeEntries) == 0 && flushedTrees == 0 {
		return nil
	}

	if err := flushTree(); err != nil {
		return err
	}

	newCommit, err := githubJSON[githubCreateCommitResponse](
		ctx,
		"POST",
		fmt.Sprintf("%s/git/commits", repoURL),
		opts.Token,
		githubCreateCommitRequest{
			Message: opts.CommitMessage,
			Tree:    currentTreeSHA,
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
	if err := paceBlobCreation(ctx); err != nil {
		return "", err
	}

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
	var payload []byte
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		payload = b
	}

	for attempt := 1; ; attempt++ {
		var reader io.Reader
		if payload != nil {
			reader = bytes.NewReader(payload)
		}

		req, err := http.NewRequestWithContext(ctx, method, url, reader)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
		if payload != nil {
			req.Header.Set("Content-Type", "application/json")
		}

		resp, err := apiClient.Do(req)
		if err != nil {
			if attempt >= maxRequestAttempts || ctx.Err() != nil {
				return nil, err
			}
			if sleepErr := sleepFn(ctx, time.Second*time.Duration(1<<(attempt-1))); sleepErr != nil {
				return nil, sleepErr
			}
			continue
		}

		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			var out T
			if len(respBody) == 0 {
				return &out, nil
			}
			if err := json.Unmarshal(respBody, &out); err != nil {
				return nil, err
			}
			return &out, nil
		}

		if !isRetryableStatus(resp.StatusCode, respBody) || attempt >= maxRequestAttempts {
			return nil, fmt.Errorf("%s %s failed (status %d): %s", method, url, resp.StatusCode, string(respBody))
		}

		delay := retryDelay(resp, respBody, attempt)
		log.Printf(
			"[github export] retrying method=%s url=%s status=%d attempt=%d delay=%s",
			method, url, resp.StatusCode, attempt, delay,
		)
		if err := sleepFn(ctx, delay); err != nil {
			return nil, err
		}
	}
}
