package github

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

func DownloadRepo(owner, repo, repoPath, ref, token string) (*zipImporter.ZipFileIterator, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/zipball/%s", owner, repo, ref)

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

type githubContentRequest struct {
	Message string `json:"message"`
	Content string `json:"content"`
	Branch  string `json:"branch,omitempty"`
	SHA     string `json:"sha,omitempty"`
}

type githubContentResponse struct {
	SHA     string `json:"sha"`
	Content string `json:"content"` // This is the base64-encoded file content
}

func UploadToRepo(owner, repo, targetPath, token string, files []FileToUpload) error {
	if token == "" {
		return fmt.Errorf("GitHub token is required")
	}

	client := &http.Client{}
	baseURL := "https://api.github.com"
	branch := "main" // Default to main branch

	// Upload each file using the Contents API
	for _, file := range files {
		// Normalize the path by joining targetPath with file.Path
		fullPath := path.Join(targetPath, file.Path)
		// Clean up any double slashes or leading slashes
		fullPath = strings.TrimPrefix(fullPath, "/")

		// Encode content to base64
		encodedContent := base64.StdEncoding.EncodeToString(file.Content)

		fileURL := fmt.Sprintf("%s/repos/%s/%s/contents/%s", baseURL, owner, repo, fullPath)

		// Fetch the latest SHA immediately before upload
		existingSHA, err := getLatestFileSHA(client, fileURL, branch, token)
		if err != nil {
			return fmt.Errorf("failed to get SHA for %s: %w", fullPath, err)
		}

		// Create or update the file
		commitMessage := fmt.Sprintf("Upload %s", fullPath)
		contentReq := githubContentRequest{
			Message: commitMessage,
			Content: encodedContent,
			Branch:  branch,
		}

		if existingSHA != "" {
			contentReq.SHA = existingSHA
		}

		contentJSON, err := json.Marshal(contentReq)
		if err != nil {
			return fmt.Errorf("failed to marshal content request for %s: %w", fullPath, err)
		}

		req, err := http.NewRequest("PUT", fileURL, bytes.NewBuffer(contentJSON))
		if err != nil {
			return fmt.Errorf("failed to create put request for %s: %w", fullPath, err)
		}
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("failed to upload file %s: %w", fullPath, err)
		}

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
			return fmt.Errorf("failed to upload file %s (status %d): %s", fullPath, resp.StatusCode, string(body))
		}
	}

	return nil
}

// Helper function to get the latest SHA for a file
func getLatestFileSHA(client *http.Client, fileURL, branch, token string) (string, error) {
	req, err := http.NewRequest("GET", fileURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	req.Header.Set("Accept", "application/vnd.github+json")

	// Add branch parameter
	q := req.URL.Query()
	q.Add("ref", branch)
	req.URL.RawQuery = q.Encode()

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		// File exists, get its SHA
		var contentResp githubContentResponse
		body, _ := io.ReadAll(resp.Body)
		if err := json.Unmarshal(body, &contentResp); err != nil {
			return "", err
		}
		return contentResp.SHA, nil
	}

	// File doesn't exist (404), return empty SHA
	return "", nil
}
