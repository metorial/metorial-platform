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

type CloudUploadOptions struct {
	Workspace     string
	Repo          string
	TargetPath    string
	Branch        string
	CommitMessage string
	Token         string
	APIURL        string
	WebURL        string

	// Bucket-relative paths to remove from the repository. Paths that are not
	// in the branch are ignored.
	DeletePaths []string

	// When set, only DeletePaths are removed. Without it the export mirrors
	// TargetPath and deletes whatever the bucket does not contain, which is
	// wrong for callers that own only part of that path.
	ExplicitDeletesOnly bool
}

func (o CloudUploadOptions) withDefaults() CloudUploadOptions {
	if o.Branch == "" {
		o.Branch = "main"
	}
	if o.CommitMessage == "" {
		o.CommitMessage = "Upload files"
	}
	return o
}

func UploadToCloudRepo(opts CloudUploadOptions, iter FileIterator) error {
	if opts.Token == "" {
		return fmt.Errorf("Bitbucket token is required")
	}
	opts = opts.withDefaults()

	normalizedTarget, err := normalizeRepoPath(opts.TargetPath, true)
	if err != nil {
		return err
	}
	apiBaseURL, err := cleanHTTPSBaseURL(opts.APIURL, defaultCloudAPIURL)
	if err != nil {
		return err
	}

	existing, err := cloudRepoFiles(
		opts.Workspace, opts.Repo, normalizedTarget, opts.Branch, opts.Token, opts.WebURL,
	)
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
	if err := writer.WriteField("branch", opts.Branch); err != nil {
		body.Close()
		return err
	}
	if err := writer.WriteField("message", opts.CommitMessage); err != nil {
		body.Close()
		return err
	}

	changed, err := writeCloudChanges(writer, normalizedTarget, existing, opts, iter)
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
		url.PathEscape(opts.Workspace),
		url.PathEscape(opts.Repo),
	)
	req, err := http.NewRequest(http.MethodPost, endpoint, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+opts.Token)
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
	opts CloudUploadOptions,
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

	// What is left in `existing` is everything under the target path the bucket
	// did not produce. Mirroring means deleting all of it, which is only correct
	// when the bucket owns the entire target path.
	deletePaths := make([]string, 0, len(existing))
	if opts.ExplicitDeletesOnly {
		for _, deletePath := range opts.DeletePaths {
			normalized, err := normalizeRepoPath(deletePath, false)
			if err != nil {
				return false, err
			}
			fullPath := path.Join(normalizedTarget, normalized)
			if _, exists := existing[fullPath]; !exists {
				continue
			}
			deletePaths = append(deletePaths, fullPath)
		}
	} else {
		for filePath := range existing {
			deletePaths = append(deletePaths, filePath)
		}
	}

	for _, filePath := range deletePaths {
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
