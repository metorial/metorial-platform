package docker

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
)

type Sizes struct {
	Images       uint64
	Containers   uint64
	LocalVolumes uint64
	BuildCache   uint64
}

type DockerSizeEntry struct {
	Size string `json:"Size"`
	Type string `json:"Type"`
}

func GetDockerSizes() (*Sizes, error) {
	cmd := exec.Command("docker", "system", "df", "--format", "{{json .}}")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get Docker sizes: %w", err)
	}

	var entries []DockerSizeEntry
	if err := json.Unmarshal(output, &entries); err != nil {
		return nil, fmt.Errorf("failed to parse Docker sizes output: %w", err)
	}

	sizes := &Sizes{}
	for _, entry := range entries {
		size, err := parseDockerSize(entry.Size)
		if err != nil {
			return nil, fmt.Errorf("failed to parse size %s: %w", entry.Size, err)
		}

		switch entry.Type {
		case "Images":
			sizes.Images += size
		case "Containers":
			sizes.Containers += size
		case "Local Volumes":
			sizes.LocalVolumes += size
		case "Build Cache":
			sizes.BuildCache += size
		}
	}

	return sizes, nil
}

func GetSystemStorageTotalAvailable() (uint64, error) {
	env := os.Getenv("CONTAINER_STORAGE_TOTAL_AVAILABLE")
	if env == "" {
		return 0, fmt.Errorf("environment variable CONTAINER_STORAGE_TOTAL_AVAILABLE is not set")
	}

	total, err := parseDockerSize(env)
	if err != nil {
		return 0, fmt.Errorf("failed to parse total available storage: %w", err)
	}

	return total, nil
}

func GetSystemStorageTotalUsed() (uint64, error) {
	sizes, err := GetDockerSizes()
	if err != nil {
		return 0, fmt.Errorf("failed to get Docker sizes: %w", err)
	}

	totalUsed := sizes.Images + sizes.Containers + sizes.LocalVolumes + sizes.BuildCache
	return totalUsed, nil
}

func GetSystemStorageUsage() (uint64, error) {
	totalUsed, err := GetSystemStorageTotalUsed()
	if err != nil {
		return 0, fmt.Errorf("failed to get total used storage: %w", err)
	}

	totalAvailable, err := GetSystemStorageTotalAvailable()
	if err != nil {
		return 0, fmt.Errorf("failed to get total available storage: %w", err)
	}

	if totalAvailable == 0 {
		return 0, nil
	}

	usage := (totalUsed * 100) / totalAvailable
	return usage, nil
}
