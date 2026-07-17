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

	zipImporter "github.com/metorial/metorial/services/code-bucket/pkg/zip-importer"
)

const maxGitlabCommitPayloadBytes = 8 * 1024 * 1024

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

func UploadToRepo(projectID int64, targetPath, branch, commitMessage, token, gitlabAPIURL string, files []FileToUpload) error {
	return UploadToRepoIter(projectID, targetPath, branch, commitMessage, token, gitlabAPIURL, func(yield func(FileToUpload) error) error {
		for _, file := range files {
			if err := yield(file); err != nil {
				return err
			}
		}
		return nil
	})
}

func UploadToRepoIter(projectID int64, targetPath, branch, commitMessage, token, gitlabAPIURL string, iter FileIterator) error {
	if token == "" {
		return fmt.Errorf("GitLab token is required")
	}

	client := &http.Client{}
	if branch == "" {
		branch = "main"
	}
	if commitMessage == "" {
		commitMessage = "Upload files"
	}

	actions := make([]gitlabFileAction, 0)
	payloadBytes := 0
	batch := 1

	flush := func() error {
		if len(actions) == 0 {
			return nil
		}

		message := commitMessage
		if batch > 1 {
			message = fmt.Sprintf("%s (batch %d)", commitMessage, batch)
		}
		if err := createCommit(client, projectID, branch, message, token, gitlabAPIURL, actions); err != nil {
			var commitErr *gitlabCommitError
			if !errors.As(err, &commitErr) || !commitErr.isFileActionConflict() {
				return err
			}

			reconciledActions, reconcileErr := reconcileActions(client, projectID, branch, token, gitlabAPIURL, actions)
			if reconcileErr != nil {
				return fmt.Errorf("failed to reconcile GitLab commit after conflict: %w", reconcileErr)
			}
			if len(reconciledActions) > 0 {
				if retryErr := createCommit(client, projectID, branch, message, token, gitlabAPIURL, reconciledActions); retryErr != nil {
					return fmt.Errorf("failed to retry GitLab commit after conflict: %w", retryErr)
				}
			}
		}

		actions = nil
		payloadBytes = 0
		batch++
		return nil
	}

	if err := iter(func(file FileToUpload) error {
		// Normalize the path by joining targetPath with file.Path
		fullPath := path.Join(targetPath, file.Path)
		// Clean up any double slashes or leading slashes
		fullPath = strings.TrimPrefix(fullPath, "/")

		// Encode content to base64
		encodedContent := base64.StdEncoding.EncodeToString(file.Content)

		// Check if file exists to determine action
		action := "create"
		fileInfo, err := getFileInfo(client, projectID, fullPath, branch, token, gitlabAPIURL)
		if err != nil {
			return fmt.Errorf("failed to get file info for %s: %w", fullPath, err)
		}
		if fileInfo.Exists {
			if fileInfo.ContentSHA256 == sha256Hex(file.Content) {
				return nil
			}
			action = "update"
		}

		encodedBytes := len(encodedContent) + len(fullPath)
		if len(actions) > 0 && payloadBytes+encodedBytes > maxGitlabCommitPayloadBytes {
			if err := flush(); err != nil {
				return err
			}
		}

		actions = append(actions, gitlabFileAction{
			Action:   action,
			FilePath: fullPath,
			Content:  encodedContent,
			Encoding: "base64",
		})
		payloadBytes += encodedBytes

		if payloadBytes >= maxGitlabCommitPayloadBytes {
			return flush()
		}

		return nil
	}); err != nil {
		return err
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

	req, err := http.NewRequest("GET", fileURL.String(), nil)
	if err != nil {
		return gitlabFileInfo{}, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	resp, err := client.Do(req)
	if err != nil {
		return gitlabFileInfo{}, err
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
