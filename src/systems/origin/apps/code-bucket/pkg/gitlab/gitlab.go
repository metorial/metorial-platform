package gitlab

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"

	zipImporter "github.com/metorial/metorial/services/code-bucket/pkg/zip-importer"
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

func UploadToRepo(projectID int64, targetPath, branch, commitMessage, token, gitlabAPIURL string, files []FileToUpload) error {
	if token == "" {
		return fmt.Errorf("GitLab token is required")
	}

	client := &http.Client{}
	if branch == "" {
		branch = "main"
	}
	if commitMessage == "" {
		commitMessage = fmt.Sprintf("Upload %d files", len(files))
	}

	// GitLab supports batch commits, so we can upload all files in a single commit
	actions := make([]gitlabFileAction, 0, len(files))

	for _, file := range files {
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
				continue
			}
			action = "update"
		}

		actions = append(actions, gitlabFileAction{
			Action:   action,
			FilePath: fullPath,
			Content:  encodedContent,
			Encoding: "base64",
		})
	}

	if len(actions) == 0 {
		return nil
	}

	// Create commit with all file actions
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
		return fmt.Errorf("failed to create commit (status %d): %s", resp.StatusCode, string(body))
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
	fileURL := fmt.Sprintf("%s/projects/%d/repository/files/%s?ref=%s",
		gitlabAPIURL,
		projectID,
		strings.ReplaceAll(filePath, "/", "%2F"), // URL encode the file path
		branch,
	)

	req, err := http.NewRequest("GET", fileURL, nil)
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
