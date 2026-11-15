package filelimit

import (
	"errors"
	"fmt"
)

const MaxBufferedFileBytes int64 = 64 << 20

var ErrFileTooLarge = errors.New("file exceeds the per-file size limit")

func FileTooLargeError(operation, path string, size, limit int64) error {
	return fmt.Errorf(
		"%w: %s is %s, over the %s per-file limit for %s",
		ErrFileTooLarge, path, HumanBytes(size), HumanBytes(limit), operation,
	)
}

func HumanBytes(size int64) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}

	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}

	return fmt.Sprintf("%.1f %ciB", float64(size)/float64(div), "KMGTPE"[exp])
}
