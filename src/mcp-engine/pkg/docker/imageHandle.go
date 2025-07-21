package docker

import (
	"fmt"
	"sync"
	"time"
)

const (
	ImageUnusedThreshold = 60 * 60
	ImageMaxAge          = 5 * 60 * 60
)

type ImageUse struct {
	Timestamp   time.Time
	ContainerID string
}

type ImageHandle struct {
	Name       string
	Tag        string
	ImageID    string
	LastUsed   time.Time
	RecentUses []ImageUse
	mu         sync.RWMutex
}

func newDockerImage(name, tag, imageID string) *ImageHandle {
	now := time.Now().UTC()
	return &ImageHandle{
		Name:       name,
		Tag:        tag,
		ImageID:    imageID,
		LastUsed:   now,
		RecentUses: make([]ImageUse, 0),
	}
}

func (img *ImageHandle) markUsed(containerID string) {
	img.mu.Lock()
	defer img.mu.Unlock()

	now := time.Now().UTC()
	img.LastUsed = now
	img.RecentUses = append(img.RecentUses, ImageUse{
		Timestamp:   now,
		ContainerID: containerID,
	})
}

func (img *ImageHandle) FullName() string {
	img.mu.RLock()
	defer img.mu.RUnlock()
	return fmt.Sprintf("%s:%s", img.Name, img.Tag)
}

func (img *ImageHandle) IsUnused() bool {
	img.mu.RLock()
	defer img.mu.RUnlock()

	threshold := time.Now().UTC().Add(-time.Duration(ImageUnusedThreshold) * time.Second)
	return img.LastUsed.Before(threshold)
}

func (img *ImageHandle) GetLastUsed() time.Time {
	img.mu.RLock()
	defer img.mu.RUnlock()
	return img.LastUsed
}

func (img *ImageHandle) cleanupOldUses() {
	img.mu.Lock()
	defer img.mu.Unlock()

	cutoff := time.Now().UTC().Add(-time.Duration(ImageMaxAge) * time.Second)

	validUses := make([]ImageUse, 0, len(img.RecentUses))
	for _, use := range img.RecentUses {
		if use.Timestamp.After(cutoff) {
			validUses = append(validUses, use)
		}
	}
	img.RecentUses = validUses
}
