package github

import (
	"fmt"

	zipImporter "github.com/metorial/metorial/services/code-bucket/pkg/zip-importer"
)

func DownloadRepo(owner, repo, path, ref, token string) (*zipImporter.ZipFileIterator, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/zipball/%s", owner, repo, ref)

	headers := map[string]string{
		"Accept": "*/*",
	}

	if token != "" {
		headers["Authorization"] = fmt.Sprintf("Bearer %s", token)
	}

	return zipImporter.DownloadZip(url, path, headers)
}
