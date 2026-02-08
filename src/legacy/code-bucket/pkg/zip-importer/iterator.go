package zipImporter

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/metorial/metorial/modules/util"
)

type ZipFileIterator struct {
	filePaths []string
	current   int
	tempDir   string

	mutex sync.Mutex
}

type ZipFileItem struct {
	Path    string
	Content []byte
}

func (it *ZipFileIterator) Next() (*ZipFileItem, bool) {
	if it.current >= len(it.filePaths) {
		return nil, false
	}

	it.mutex.Lock()
	filePath := it.filePaths[it.current]
	it.current++
	it.mutex.Unlock()

	content, err := os.ReadFile(filePath)
	if err != nil {
		return nil, false
	}

	return &ZipFileItem{
		Content: content,
		Path:    util.MustOrFallback(filePath)(filepath.Rel(it.tempDir, filePath)),
	}, true
}

func (it *ZipFileIterator) Close() error {
	it.mutex.Lock()
	defer it.mutex.Unlock()

	if it.tempDir != "" {
		if err := os.RemoveAll(it.tempDir); err != nil {
			return fmt.Errorf("failed to clean up temp directory %s: %w", it.tempDir, err)
		}

		it.tempDir = ""
	}

	return nil
}
