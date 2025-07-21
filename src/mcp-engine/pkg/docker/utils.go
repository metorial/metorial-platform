package docker

import (
	"fmt"
	"strconv"
	"strings"
)

var units = map[string]float64{
	"kB": 1e3,
	"MB": 1e6,
	"GB": 1e9,
	"TB": 1e12,
}

func getImageFullName(repository, tag string) (string, error) {
	if repository == "" || tag == "" {
		return "", fmt.Errorf("repository and tag must be specified")
	}

	return fmt.Sprintf("%s:%s", repository, tag), nil
}

func parseImageFullName(fullName string) (string, string, error) {
	parts := strings.SplitN(fullName, ":", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid image full name format: %s", fullName)
	}

	repository := parts[0]
	if repository == "" {
		return "", "", fmt.Errorf("repository cannot be empty in image full name: %s", fullName)
	}

	tag := parts[1]
	if tag == "" {
		tag = "latest" // Default tag if not specified
	}

	return repository, tag, nil
}

func parseDockerSize(sizeStr string) (uint64, error) {
	sizeStr = strings.TrimSpace(sizeStr)
	if sizeStr == "" {
		return 0, fmt.Errorf("empty size string")
	}

	// Find unit suffix
	for unit, multiplier := range units {
		if strings.HasSuffix(sizeStr, unit) {
			valueStr := strings.TrimSuffix(sizeStr, unit)
			value, err := strconv.ParseFloat(valueStr, 64)
			if err != nil {
				return 0, fmt.Errorf("invalid size value: %v", err)
			}
			return uint64(value * multiplier), nil
		}
	}

	if strings.HasSuffix(sizeStr, "B") {
		// Handle plain bytes without unit
		valueStr := strings.TrimSuffix(sizeStr, "B")
		value, err := strconv.ParseUint(valueStr, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid size value: %v", err)
		}
		return value, nil
	}

	value, err := strconv.ParseUint(sizeStr, 10, 64)
	if err == nil {
		return value, nil
	}

	return 0, fmt.Errorf("unrecognized size unit in: %s", sizeStr)
}
