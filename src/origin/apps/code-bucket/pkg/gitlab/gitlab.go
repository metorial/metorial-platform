package gitlab

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	zipImporter "github.com/metorial/metorial/services/code-bucket/pkg/zip-importer"
)

const (
	maxGitlabCommitPayloadBytes = 8 * 1024 * 1024
	maxGitlabFileInfoAttempts   = 4
)

func DownloadRepo(projectID int64, repoPath, ref, token, gitlabAPIURL string) (*zipImporter.ZipFileIterator, error) {
	// GitLab API endpoint for downloading repository archive
	url := fmt.Sprintf("%s/projects/%d/repository/archive.zip?sha=%s", gitlabAPIURL, projectID, ref)

	headers := map[string]string{
		"Accept": "*/*",
	}

	if token != "" {
		headers["Authorization"] = fmt.Sprintf("Bearer %s", token)
	}

	return zipImporter.DownloadZip(url, repoPath, headers)
}

type FileToUpload struct {
	Path    string
	Content []byte
}

type FileIterator func(func(FileToUpload) error) error

type UploadOptions struct {
	ProjectID     int64
	TargetPath    string
	Branch        string
	CommitMessage string
	Token         string
	GitlabAPIURL  string

	// Bucket-relative paths to remove from the repository. Paths that are not
	// in the branch are ignored.
	DeletePaths []string
}

func (o UploadOptions) withDefaults() UploadOptions {
	if o.Branch == "" {
		o.Branch = "main"
	}
	if o.CommitMessage == "" {
		o.CommitMessage = "Upload files"
	}
	return o
}

type gitlabFileAction struct {
	Action   string `json:"action"`
	FilePath string `json:"file_path"`
	Content  string `json:"content"`
	Encoding string `json:"encoding,omitempty"`
}

type gitlabCommitRequest struct {
	Branch        string             `json:"branch"`
	CommitMessage string             `json:"commit_message"`
	Actions       []gitlabFileAction `json:"actions"`
}

type gitlabCommitError struct {
	StatusCode int
	Body       string
}

func (e *gitlabCommitError) Error() string {
	return fmt.Sprintf("failed to create commit (status %d): %s", e.StatusCode, e.Body)
}

func UploadToRepo(opts UploadOptions, files []FileToUpload) error {
	return UploadToRepoIter(opts, func(yield func(FileToUpload) error) error {
		for _, file := range files {
			if err := yield(file); err != nil {
				return err
			}
		}
		return nil
	})
}

func UploadToRepoIter(opts UploadOptions, iter FileIterator) error {
	if opts.Token == "" {
		return fmt.Errorf("GitLab token is required")
	}
	opts = opts.withDefaults()

	client := &http.Client{}

	actions := make([]gitlabFileAction, 0)
	payloadBytes := 0
	batch := 1

	// Every path the bucket still holds, including ones skipped because their
	// content is unchanged. A stale delete request for such a path must not
	// remove a file that is still part of the export.
	writtenPaths := map[string]struct{}{}

	flush := func() error {
		if len(actions) == 0 {
			return nil
		}

		message := opts.CommitMessage
		if batch > 1 {
			message = fmt.Sprintf("%s (batch %d)", opts.CommitMessage, batch)
		}
		if err := createCommit(client, opts.ProjectID, opts.Branch, message, opts.Token, opts.GitlabAPIURL, actions); err != nil {
			var commitErr *gitlabCommitError
			if !errors.As(err, &commitErr) || !commitErr.isFileActionConflict() {
				return err
			}

			reconciledActions, reconcileErr := reconcileActions(client, opts.ProjectID, opts.Branch, opts.Token, opts.GitlabAPIURL, actions)
			if reconcileErr != nil {
				return fmt.Errorf("failed to reconcile GitLab commit after conflict: %w", reconcileErr)
			}
			if len(reconciledActions) > 0 {
				if retryErr := createCommit(client, opts.ProjectID, opts.Branch, message, opts.Token, opts.GitlabAPIURL, reconciledActions); retryErr != nil {
					return fmt.Errorf("failed to retry GitLab commit after conflict: %w", retryErr)
				}
			}
		}

		actions = nil
		payloadBytes = 0
		batch++
		return nil
	}

	addAction := func(action gitlabFileAction, size int) error {
		if len(actions) > 0 && payloadBytes+size > maxGitlabCommitPayloadBytes {
			if err := flush(); err != nil {
				return err
			}
		}

		actions = append(actions, action)
		payloadBytes += size

		if payloadBytes >= maxGitlabCommitPayloadBytes {
			return flush()
		}

		return nil
	}

	if err := iter(func(file FileToUpload) error {
		// Normalize the path by joining targetPath with file.Path
		fullPath := path.Join(opts.TargetPath, file.Path)
		// Clean up any double slashes or leading slashes
		fullPath = strings.TrimPrefix(fullPath, "/")
		writtenPaths[fullPath] = struct{}{}

		// Encode content to base64
		encodedContent := base64.StdEncoding.EncodeToString(file.Content)

		// Check if file exists to determine action
		action := "create"
		fileInfo, err := getFileInfo(client, opts.ProjectID, fullPath, opts.Branch, opts.Token, opts.GitlabAPIURL)
		if err != nil {
			return fmt.Errorf("failed to get file info for %s: %w", fullPath, err)
		}
		if fileInfo.Exists {
			if fileInfo.ContentSHA256 == sha256Hex(file.Content) {
				return nil
			}
			action = "update"
		}

		return addAction(gitlabFileAction{
			Action:   action,
			FilePath: fullPath,
			Content:  encodedContent,
			Encoding: "base64",
		}, len(encodedContent)+len(fullPath))
	}); err != nil {
		return err
	}

	for _, deletePath := range opts.DeletePaths {
		fullPath := strings.TrimPrefix(path.Join(opts.TargetPath, deletePath), "/")

		// A path the export just wrote is not a deletion; the caller may have
		// recreated it since the removal was recorded.
		if _, written := writtenPaths[fullPath]; written {
			continue
		}

		// Deleting a path that is not on the branch fails the whole commit, so
		// existence is checked rather than assumed.
		fileInfo, err := getFileInfo(client, opts.ProjectID, fullPath, opts.Branch, opts.Token, opts.GitlabAPIURL)
		if err != nil {
			return fmt.Errorf("failed to get file info for %s: %w", fullPath, err)
		}
		if !fileInfo.Exists {
			continue
		}

		if err := addAction(gitlabFileAction{
			Action:   "delete",
			FilePath: fullPath,
		}, len(fullPath)); err != nil {
			return err
		}
	}

	return flush()
}

func (e *gitlabCommitError) isFileActionConflict() bool {
	if e.StatusCode != http.StatusBadRequest {
		return false
	}

	body := strings.ToLower(e.Body)
	return strings.Contains(body, "already exists") || strings.Contains(body, "does not exist")
}

func reconcileActions(client *http.Client, projectID int64, branch, token, gitlabAPIURL string, actions []gitlabFileAction) ([]gitlabFileAction, error) {
	reconciled := make([]gitlabFileAction, 0, len(actions))

	for _, action := range actions {
		fileInfo, err := getFileInfo(client, projectID, action.FilePath, branch, token, gitlabAPIURL)
		if err != nil {
			return nil, fmt.Errorf("failed to get file info for %s: %w", action.FilePath, err)
		}

		// A delete is either still valid or already satisfied; it must never be
		// rewritten into a create or update, which would restore the file with
		// the action's empty content.
		if action.Action == "delete" {
			if fileInfo.Exists {
				reconciled = append(reconciled, action)
			}
			continue
		}

		if !fileInfo.Exists {
			action.Action = "create"
			reconciled = append(reconciled, action)
			continue
		}

		content, err := base64.StdEncoding.DecodeString(action.Content)
		if err != nil {
			return nil, fmt.Errorf("failed to decode content for %s: %w", action.FilePath, err)
		}
		if fileInfo.ContentSHA256 == sha256Hex(content) {
			continue
		}

		action.Action = "update"
		reconciled = append(reconciled, action)
	}

	return reconciled, nil
}

func createCommit(client *http.Client, projectID int64, branch, commitMessage, token, gitlabAPIURL string, actions []gitlabFileAction) error {
	commitReq := gitlabCommitRequest{
		Branch:        branch,
		CommitMessage: commitMessage,
		Actions:       actions,
	}

	commitJSON, err := json.Marshal(commitReq)
	if err != nil {
		return fmt.Errorf("failed to marshal commit request: %w", err)
	}

	// POST to commits API
	commitURL := fmt.Sprintf("%s/projects/%d/repository/commits", gitlabAPIURL, projectID)
	req, err := http.NewRequest("POST", commitURL, bytes.NewBuffer(commitJSON))
	if err != nil {
		return fmt.Errorf("failed to create commit request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to create commit: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return &gitlabCommitError{StatusCode: resp.StatusCode, Body: string(body)}
	}

	return nil
}

type gitlabFileInfo struct {
	Exists        bool
	ContentSHA256 string `json:"content_sha256"`
}

func sha256Hex(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])
}

// Helper function to get file metadata in the repository
func getFileInfo(client *http.Client, projectID int64, filePath, branch, token, gitlabAPIURL string) (gitlabFileInfo, error) {
	return getFileInfoWithRetry(client, projectID, filePath, branch, token, gitlabAPIURL, func(attempt int) {
		time.Sleep(250 * time.Millisecond * time.Duration(1<<(attempt-1)))
	})
}

func getFileInfoWithRetry(client *http.Client, projectID int64, filePath, branch, token, gitlabAPIURL string, wait func(int)) (gitlabFileInfo, error) {
	fileURL, err := url.Parse(fmt.Sprintf("%s/projects/%d/repository/files/%s",
		gitlabAPIURL,
		projectID,
		url.PathEscape(filePath),
	))
	if err != nil {
		return gitlabFileInfo{}, err
	}
	query := fileURL.Query()
	query.Set("ref", branch)
	fileURL.RawQuery = query.Encode()

	for attempt := 1; attempt <= maxGitlabFileInfoAttempts; attempt++ {
		if attempt > 1 {
			wait(attempt - 1)
		}

		req, err := http.NewRequest("GET", fileURL.String(), nil)
		if err != nil {
			return gitlabFileInfo{}, err
		}
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

		resp, err := client.Do(req)
		if err != nil {
			if attempt < maxGitlabFileInfoAttempts {
				continue
			}
			return gitlabFileInfo{}, err
		}

		if (resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= http.StatusInternalServerError) && attempt < maxGitlabFileInfoAttempts {
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusNotFound {
			return gitlabFileInfo{Exists: false}, nil
		}

		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusOK {
			return gitlabFileInfo{}, fmt.Errorf("failed to get file metadata (status %d): %s", resp.StatusCode, string(body))
		}

		var info gitlabFileInfo
		if err := json.Unmarshal(body, &info); err != nil {
			return gitlabFileInfo{}, err
		}
		info.Exists = true

		return info, nil
	}

	return gitlabFileInfo{}, fmt.Errorf("failed to get file metadata after %d attempts", maxGitlabFileInfoAttempts)
}
