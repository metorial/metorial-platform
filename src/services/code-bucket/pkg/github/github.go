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
	Content struct {
		SHA string `json:"sha"`
	} `json:"content"`
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

		// Check if file exists to get its SHA (for updates)
		fileURL := fmt.Sprintf("%s/repos/%s/%s/contents/%s", baseURL, owner, repo, fullPath)
		req, err := http.NewRequest("GET", fileURL, nil)
		if err != nil {
			return fmt.Errorf("failed to create get request for %s: %w", fullPath, err)
		}
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		req.Header.Set("Accept", "application/vnd.github+json")

		// Add branch parameter to check for file on specific branch
		q := req.URL.Query()
		q.Add("ref", branch)
		req.URL.RawQuery = q.Encode()

		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("failed to check file %s: %w", fullPath, err)
		}

		var existingSHA string
		if resp.StatusCode == http.StatusOK {
			// File exists, get its SHA
			var contentResp githubContentResponse
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err := json.Unmarshal(body, &contentResp); err != nil {
				return fmt.Errorf("failed to decode content response for %s: %w", fullPath, err)
			}
			existingSHA = contentResp.Content.SHA
		} else {
			resp.Body.Close()
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

		req, err = http.NewRequest("PUT", fileURL, bytes.NewBuffer(contentJSON))
		if err != nil {
			return fmt.Errorf("failed to create put request for %s: %w", fullPath, err)
		}
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("Content-Type", "application/json")

		resp, err = client.Do(req)
		if err != nil {
			return fmt.Errorf("failed to upload file %s: %w", fullPath, err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("failed to upload file %s (status %d): %s", fullPath, resp.StatusCode, string(body))
		}
	}

	return nil
}
