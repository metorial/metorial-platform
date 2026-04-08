package zipImporter

import (
	"archive/zip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var httpClient = &http.Client{
	Timeout: 10 * time.Minute,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
	},
}

func DownloadZip(url, path string, headers map[string]string) (*ZipFileIterator, error) {
	tmpDir, err := os.MkdirTemp("", "gh-zip-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}

	zipPath := filepath.Join(tmpDir, "repo.zip")
	if err := downloadFile(url, zipPath, headers); err != nil {
		return nil, fmt.Errorf("failed to download zip: %w", err)
	}

	extractDir := filepath.Join(tmpDir, "unzipped")
	if err := unzip(zipPath, extractDir); err != nil {
		return nil, fmt.Errorf("failed to unzip archive: %w", err)
	}

	topDirs, err := os.ReadDir(extractDir)
	if err != nil || len(topDirs) == 0 {
		return nil, fmt.Errorf("unexpected archive structure")
	}
	repoRoot := filepath.Join(extractDir, topDirs[0].Name())

	targetPath := filepath.Join(repoRoot, path)
	var filePaths []string
	err = filepath.Walk(targetPath, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			filePaths = append(filePaths, p)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("error walking subdirectory: %w", err)
	}

	return &ZipFileIterator{
		filePaths: filePaths,
		current:   0,
		tempDir:   targetPath,
	}, nil
}

func downloadFile(url, dest string, headers map[string]string) error {
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Metorial CodeBucket (https://metorial.com)")

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusFound {
		return fmt.Errorf("bad status: %s", resp.Status)
	}

	if resp.StatusCode == http.StatusFound {
		loc := resp.Header.Get("Location")
		return downloadFile(loc, dest, headers)
	}

	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

func unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		fpath := filepath.Join(dest, f.Name)
		if !strings.HasPrefix(fpath, filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("illegal file path: %s", fpath)
		}

		if f.FileInfo().IsDir() {
			err := os.MkdirAll(fpath, os.ModePerm)
			if err != nil {
				return err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(fpath), os.ModePerm); err != nil {
			return err
		}

		inFile, err := f.Open()
		if err != nil {
			return err
		}
		defer inFile.Close()

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}
		defer outFile.Close()

		_, err = io.Copy(outFile, inFile)
		if err != nil {
			return err
		}
	}
	return nil
}
