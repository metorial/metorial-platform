package github

import (
	"bytes"
	"crypto/sha1"
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

func UploadToRepo(owner, repo, targetPath, branch, commitMessage, token string, files []FileToUpload) error {
	if token == "" {
		return fmt.Errorf("GitHub token is required")
	}

	client := &http.Client{}
	baseURL := "https://api.github.com"
	if branch == "" {
		branch = "main"
	}
	if commitMessage == "" {
		commitMessage = fmt.Sprintf("Upload %d files", len(files))
	}

	ref, err := githubJSON[githubRefResponse](client, "GET", fmt.Sprintf("%s/repos/%s/%s/git/ref/heads/%s", baseURL, owner, repo, branch), token, nil)
	if err != nil {
		return fmt.Errorf("failed to get branch ref %s: %w", branch, err)
	}

	baseCommit, err := githubJSON[githubCommitResponse](client, "GET", fmt.Sprintf("%s/repos/%s/%s/git/commits/%s", baseURL, owner, repo, ref.Object.SHA), token, nil)
	if err != nil {
		return fmt.Errorf("failed to get base commit %s: %w", ref.Object.SHA, err)
	}

	baseTree, err := githubJSON[githubTreeResponse](client, "GET", fmt.Sprintf("%s/repos/%s/%s/git/trees/%s?recursive=1", baseURL, owner, repo, baseCommit.Tree.SHA), token, nil)
	if err != nil {
		return fmt.Errorf("failed to get base tree %s: %w", baseCommit.Tree.SHA, err)
	}

	existingBlobShas := map[string]string{}
	for _, entry := range baseTree.Tree {
		if entry.Type == "blob" {
			existingBlobShas[entry.Path] = entry.SHA
		}
	}

	treeEntries := make([]githubTreeEntry, 0, len(files))
	for _, file := range files {
		// Normalize the path by joining targetPath with file.Path
		fullPath := path.Join(targetPath, file.Path)
		// Clean up any double slashes or leading slashes
		fullPath = strings.TrimPrefix(fullPath, "/")

		if existingBlobShas[fullPath] == gitBlobSHA(file.Content) {
			continue
		}

		blob, err := githubJSON[githubCreateBlobResponse](
			client,
			"POST",
			fmt.Sprintf("%s/repos/%s/%s/git/blobs", baseURL, owner, repo),
			token,
			githubCreateBlobRequest{
				Content:  base64.StdEncoding.EncodeToString(file.Content),
				Encoding: "base64",
			},
		)
		if err != nil {
			return fmt.Errorf("failed to create blob for %s: %w", fullPath, err)
		}

		treeEntries = append(treeEntries, githubTreeEntry{
			Path: fullPath,
			Mode: "100644",
			Type: "blob",
			SHA:  blob.SHA,
		})
	}

	if len(treeEntries) == 0 {
		return nil
	}

	newTree, err := githubJSON[githubCreateTreeResponse](
		client,
		"POST",
		fmt.Sprintf("%s/repos/%s/%s/git/trees", baseURL, owner, repo),
		token,
		githubCreateTreeRequest{
			BaseTree: baseCommit.Tree.SHA,
			Tree:     treeEntries,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to create tree: %w", err)
	}

	newCommit, err := githubJSON[githubCreateCommitResponse](
		client,
		"POST",
		fmt.Sprintf("%s/repos/%s/%s/git/commits", baseURL, owner, repo),
		token,
		githubCreateCommitRequest{
			Message: commitMessage,
			Tree:    newTree.SHA,
			Parents: []string{baseCommit.SHA},
		},
	)
	if err != nil {
		return fmt.Errorf("failed to create commit: %w", err)
	}

	_, err = githubJSON[githubRefResponse](
		client,
		"PATCH",
		fmt.Sprintf("%s/repos/%s/%s/git/refs/heads/%s", baseURL, owner, repo, branch),
		token,
		githubUpdateRefRequest{
			SHA:   newCommit.SHA,
			Force: false,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to update branch ref %s: %w", branch, err)
	}

	return nil
}

func gitBlobSHA(content []byte) string {
	h := sha1.New()
	_, _ = h.Write([]byte(fmt.Sprintf("blob %d\x00", len(content))))
	_, _ = h.Write(content)
	return hex.EncodeToString(h.Sum(nil))
}

func githubJSON[T any](client *http.Client, method, url, token string, body any) (*T, error) {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		reader = bytes.NewBuffer(b)
	}

	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := client.Do(req)
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
