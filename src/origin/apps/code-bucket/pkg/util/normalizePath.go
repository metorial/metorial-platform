package util

import (
	"path"
	"strings"
)

// NormalizePath normalizes a file path to match the TypeScript implementation.
// It ensures the path:
// 1. Always starts with "/"
// 2. Uses forward slashes
// 3. Resolves "." and ".." segments
// 4. Removes empty segments
func NormalizePath(filePath string) string {
	if filePath == "" {
		return "/"
	}

	// Split by slashes and filter out empty segments and "." segments
	segments := strings.Split(filePath, "/")
	normalized := []string{}

	for _, segment := range segments {
		if segment == "" || segment == "." {
			continue
		}
		if segment == ".." {
			// Remove last segment if it exists (go up one directory)
			if len(normalized) > 0 {
				normalized = normalized[:len(normalized)-1]
			}
		} else {
			normalized = append(normalized, segment)
		}
	}

	// Join with "/" and ensure leading slash
	result := "/" + strings.Join(normalized, "/")

	return result
}

// NormalizePathClean is an alternative using path.Clean for comparison
func NormalizePathClean(filePath string) string {
	if filePath == "" {
		return "/"
	}

	// Ensure path starts with /
	if !strings.HasPrefix(filePath, "/") {
		filePath = "/" + filePath
	}

	// Clean the path (resolves . and .., removes redundant separators)
	cleaned := path.Clean(filePath)

	return cleaned
}
