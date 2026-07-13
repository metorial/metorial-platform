package bitbucket

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"
)

const (
	defaultCloudAPIURL = "https://api.bitbucket.org/2.0"
	defaultCloudWebURL = "https://bitbucket.org"
)

type FileToUpload struct {
	Path    string
	Content []byte
}

type FileIterator func(func(FileToUpload) error) error

func PrepareCloudRepo(
	ctx context.Context,
	workspace, repo, repoPath, ref, token, webURL string,
) (FileIterator, func(), error) {
	baseURL, err := cleanHTTPSBaseURL(webURL, defaultCloudWebURL)
	if err != nil {
		return nil, nil, err
	}
	if token == "" {
		return nil, nil, fmt.Errorf("Bitbucket token is required")
	}

	cloneURL := fmt.Sprintf(
		"%s/%s/%s.git",
		baseURL,
		url.PathEscape(workspace),
		url.PathEscape(repo),
	)
	return PrepareDataCenterRepo(ctx, cloneURL, repoPath, ref, "x-token-auth", token)
}

func UploadToCloudRepo(
	workspace, repo, targetPath, branch, commitMessage, token, apiURL, webURL string,
	iter FileIterator,
) error {
	if token == "" {
		return fmt.Errorf("Bitbucket token is required")
	}
	if branch == "" {
		branch = "main"
	}
	if commitMessage == "" {
		commitMessage = "Upload files"
	}

	normalizedTarget, err := normalizeRepoPath(targetPath, true)
	if err != nil {
		return err
	}
	apiBaseURL, err := cleanHTTPSBaseURL(apiURL, defaultCloudAPIURL)
	if err != nil {
		return err
	}

	existing, err := cloudRepoFiles(workspace, repo, normalizedTarget, branch, token, webURL)
	if err != nil {
		return fmt.Errorf("failed to inspect existing Bitbucket files: %w", err)
	}

	body, err := os.CreateTemp("", "bitbucket-cloud-upload-*.multipart")
	if err != nil {
		return fmt.Errorf("failed to create upload body: %w", err)
	}
	bodyName := body.Name()
	defer os.Remove(bodyName)

	writer := multipart.NewWriter(body)
	if err := writer.WriteField("branch", branch); err != nil {
		body.Close()
		return err
	}
	if err := writer.WriteField("message", commitMessage); err != nil {
		body.Close()
		return err
	}

	changed, err := writeCloudChanges(writer, normalizedTarget, existing, iter)
	if err != nil {
		body.Close()
		return err
	}

	if err := writer.Close(); err != nil {
		body.Close()
		return fmt.Errorf("failed to finish upload body: %w", err)
	}
	if err := body.Close(); err != nil {
		return err
	}
	if !changed {
		return nil
	}

	body, err = os.Open(bodyName)
	if err != nil {
		return err
	}
	defer body.Close()

	endpoint := fmt.Sprintf(
		"%s/repositories/%s/%s/src",
		apiBaseURL,
		url.PathEscape(workspace),
		url.PathEscape(repo),
	)
	req, err := http.NewRequest(http.MethodPost, endpoint, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", writer.FormDataContentType())

	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("Bitbucket source upload failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		responseBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("Bitbucket source upload failed (status %d): %s", resp.StatusCode, responseBody)
	}
	return nil
}

func writeCloudChanges(
	writer *multipart.Writer,
	normalizedTarget string,
	existing map[string][]byte,
	iter FileIterator,
) (bool, error) {
	changed := false
	if err := iter(func(file FileToUpload) error {
		filePath, err := normalizeRepoPath(file.Path, false)
		if err != nil {
			return err
		}
		fullPath := path.Join(normalizedTarget, filePath)
		existingContent, exists := existing[fullPath]
		delete(existing, fullPath)
		if exists && bytes.Equal(existingContent, file.Content) {
			return nil
		}

		part, err := writer.CreateFormFile("/"+fullPath, path.Base(fullPath))
		if err != nil {
			return err
		}
		if _, err := part.Write(file.Content); err != nil {
			return err
		}
		changed = true
		return nil
	}); err != nil {
		return false, err
	}

	for filePath := range existing {
		if err := writer.WriteField("files", "/"+filePath); err != nil {
			return false, err
		}
		changed = true
	}
	return changed, nil
}

func cloudRepoFiles(workspace, repo, targetPath, ref, token, webURL string) (map[string][]byte, error) {
	iter, cleanup, err := PrepareCloudRepo(
		context.Background(),
		workspace,
		repo,
		"",
		ref,
		token,
		webURL,
	)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	files := map[string][]byte{}
	prefix := targetPath
	if prefix != "" {
		prefix += "/"
	}
	err = iter(func(file FileToUpload) error {
		filePath := path.Clean(strings.ReplaceAll(file.Path, "\\", "/"))
		if targetPath == "" || filePath == targetPath || strings.HasPrefix(filePath, prefix) {
			files[filePath] = file.Content
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return files, nil
}

func normalizeRepoPath(value string, allowRoot bool) (string, error) {
	value = strings.ReplaceAll(strings.TrimSpace(value), "\\", "/")
	value = strings.TrimPrefix(value, "/")
	cleaned := path.Clean(value)
	if cleaned == "." && allowRoot {
		return "", nil
	}
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") || strings.Contains(cleaned, "\x00") {
		return "", fmt.Errorf("unsafe repository path")
	}
	return cleaned, nil
}

func cleanHTTPSBaseURL(value, fallback string) (string, error) {
	if value == "" {
		value = fallback
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return "", fmt.Errorf("Bitbucket URL must be an HTTPS URL without credentials")
	}
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return strings.TrimRight(parsed.String(), "/"), nil
}
