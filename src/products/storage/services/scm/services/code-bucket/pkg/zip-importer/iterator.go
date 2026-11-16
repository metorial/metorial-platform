package zipImporter

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/metorial/metorial/services/code-bucket/pkg/filelimit"
	"github.com/metorial/metorial/services/code-bucket/pkg/util"
)

type ZipFileIterator struct {
	files     chan string
	done      chan struct{}
	closeOnce sync.Once
	err       error
	tempDir   string
	mutex     sync.Mutex
}

type ZipFileItem struct {
	Path    string
	Content []byte
}

type Importer interface {
	Next() (*ZipFileItem, bool)
	Err() error
}

var _ Importer = (*ZipFileIterator)(nil)

func (it *ZipFileIterator) Next() (*ZipFileItem, bool) {
	filePath, ok := <-it.files
	if !ok {
		return nil, false
	}

	relative := util.MustOrFallback(filePath)(filepath.Rel(it.tempDir, filePath))

	info, err := os.Stat(filePath)
	if err != nil {
		it.setErr(fmt.Errorf("failed to inspect extracted file %s: %w", relative, err))
		return nil, false
	}
	if info.Size() > filelimit.MaxBufferedFileBytes {
		it.setErr(filelimit.FileTooLargeError(
			"zip import", relative, info.Size(), filelimit.MaxBufferedFileBytes,
		))
		return nil, false
	}

	content, err := os.ReadFile(filePath)
	if err != nil {
		it.setErr(fmt.Errorf("failed to read extracted file %s: %w", relative, err))
		return nil, false
	}

	return &ZipFileItem{
		Content: content,
		Path:    relative,
	}, true
}

func (it *ZipFileIterator) setErr(err error) {
	it.mutex.Lock()
	defer it.mutex.Unlock()

	if it.err == nil {
		it.err = err
	}
}

func (it *ZipFileIterator) Err() error {
	it.mutex.Lock()
	defer it.mutex.Unlock()
	return it.err
}

func (it *ZipFileIterator) Close() error {
	it.closeOnce.Do(func() {
		close(it.done)
	})

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

func NewZipFileIterator(tempDir string) *ZipFileIterator {
	it := &ZipFileIterator{
		files:   make(chan string),
		done:    make(chan struct{}),
		tempDir: tempDir,
	}

	go func() {
		defer close(it.files)

		err := filepath.WalkDir(tempDir, func(p string, entry os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if entry.IsDir() {
				return nil
			}

			select {
			case it.files <- p:
			case <-it.done:
				return filepath.SkipAll
			}
			return nil
		})
		if err != nil {
			it.mutex.Lock()
			it.err = err
			it.mutex.Unlock()
		}
	}()

	return it
}
