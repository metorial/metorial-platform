package docker

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

const CLEANUP_INTERVAL = time.Minute * 5

type ImageManager struct {
	images map[string]*ImageHandle
	mu     sync.RWMutex
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

func newImageManager() *ImageManager {
	ctx, cancel := context.WithCancel(context.Background())

	manager := &ImageManager{
		images: make(map[string]*ImageHandle),
		ctx:    ctx,
		cancel: cancel,
	}

	manager.startCleanupTask()
	return manager
}

func (im *ImageManager) close() {
	im.cancel()
	im.wg.Wait()
}

func (im *ImageManager) hasImage(imageName string) bool {
	im.mu.RLock()
	defer im.mu.RUnlock()

	_, exists := im.images[imageName]
	return exists
}

func (im *ImageManager) ensureImage(imageName string) error {

}

func (im *ImageManager) reportImageUse(imageName, containerID string) {
	im.mu.RLock()
	image, exists := im.images[imageName]
	im.mu.RUnlock()

	if !exists {
		return
	}

	image.markUsed(containerID)
}

func (im *ImageManager) listImages() []*ImageHandle {

}

func (im *ImageManager) getImage(imageName string) (*ImageHandle, error) {
	im.mu.RLock()
	image, exists := im.images[imageName]
	im.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("image %s not found", imageName)
	}
	return image, nil
}

func (im *ImageManager) removeImage(imageName string) error {

}

func (im *ImageManager) removeUnusedImages() {
	im.mu.RLock()

	var imagesToRemove []string
	for name, image := range im.images {
		if image.IsUnused() {
			imagesToRemove = append(imagesToRemove, name)
		}
	}

	im.mu.RUnlock()

	for _, imageName := range imagesToRemove {
		if err := im.removeImage(imageName); err != nil {
			log.Printf("Error removing unused image %s: %v\n", imageName, err)
		}
	}
}

func (im *ImageManager) removeOldImageUses() {
	im.mu.RLock()
	defer im.mu.RUnlock()

	for _, image := range im.images {
		image.cleanupOldUses()
	}
}

func (im *ImageManager) startCleanupTask() {
	im.wg.Add(1)

	go func() {
		defer im.wg.Done()

		ticker := time.NewTicker(CLEANUP_INTERVAL)
		defer ticker.Stop()

		for {
			select {
			case <-im.ctx.Done():
				return
			case <-ticker.C:
				im.performCleanup()
			}
		}
	}()
}

func (im *ImageManager) performCleanup() {
	im.removeUnusedImages()
	im.removeOldImageUses()

	log.Println("Image cleanup completed")
}
