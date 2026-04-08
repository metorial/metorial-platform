package gitlab

import (
	"bytes"
	"encoding/base64"
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
}

type gitlabCommitRequest struct {
	Branch        string             `json:"branch"`
	CommitMessage string             `json:"commit_message"`
	Actions       []gitlabFileAction `json:"actions"`
}

func UploadToRepo(projectID int64, targetPath, token, gitlabAPIURL string, files []FileToUpload) error {
	if token == "" {
		return fmt.Errorf("GitLab token is required")
	}

	client := &http.Client{}
	branch := "main" // Default to main branch

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
		if fileExists, _ := checkFileExists(client, projectID, fullPath, branch, token, gitlabAPIURL); fileExists {
			action = "update"
		}

		actions = append(actions, gitlabFileAction{
			Action:   action,
			FilePath: fullPath,
			Content:  encodedContent,
		})
	}

	// Create commit with all file actions
	commitReq := gitlabCommitRequest{
		Branch:        branch,
		CommitMessage: fmt.Sprintf("Upload %d files", len(files)),
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

// Helper function to check if a file exists in the repository
func checkFileExists(client *http.Client, projectID int64, filePath, branch, token, gitlabAPIURL string) (bool, error) {
	fileURL := fmt.Sprintf("%s/projects/%d/repository/files/%s?ref=%s",
		gitlabAPIURL,
		projectID,
		strings.ReplaceAll(filePath, "/", "%2F"), // URL encode the file path
		branch,
	)

	req, err := http.NewRequest("GET", fileURL, nil)
	if err != nil {
		return false, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK, nil
}
