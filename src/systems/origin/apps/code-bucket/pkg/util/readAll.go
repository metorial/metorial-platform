package util

import (
	"fmt"
	"io"
)

func ReadAll(reader io.Reader) ([]byte, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read data: %w", err)
	}
	return data, nil
}
