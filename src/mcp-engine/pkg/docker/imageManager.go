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

	localImageManager *localImageManager
}

func newImageManager() *ImageManager {
	ctx, cancel := context.WithCancel(context.Background())

	manager := &ImageManager{
		images: make(map[string]*ImageHandle),
		ctx:    ctx,
		cancel: cancel,

		localImageManager: newLocalImageManager(ctx),
	}

	manager.startCleanupTask()
	return manager
}

func (im *ImageManager) close() {
	im.cancel()
	im.wg.Wait()
}

func (im *ImageManager) ensureImage(repository, tag string) (*ImageHandle, error) {
	localImage, err := im.localImageManager.getImageOrFallback(repository, tag)
	if err != nil {
		return nil, fmt.Errorf("failed to get local image: %w", err)
	}

	imageName := localImage.FullName()

	im.mu.Lock()
	defer im.mu.Unlock()

	handle, exists := im.images[imageName]
	if !exists {
		handle = newDockerImage(localImage.Repository, localImage.Tag, localImage.ID)
		im.images[imageName] = handle
	}

	handle.ImageID = localImage.ID
	handle.markUsed()

	localImage.LastUsedAt = time.Now()

	return im.images[imageName], nil
}

func (im *ImageManager) ensureImageByFullName(fullName string) (*ImageHandle, error) {
	repository, tag, err := parseImageFullName(fullName)
	if err != nil {
		return nil, fmt.Errorf("failed to parse image full name: %w", err)
	}

	return im.ensureImage(repository, tag)
}

func (im *ImageManager) listImages() []*localImage {
	return im.localImageManager.listImages()
}

func (im *ImageManager) getImage(imageId string) (*localImage, error) {
	return im.localImageManager.getImage(imageId)
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
	im.removeOldImageUses()
	im.localImageManager.cleanupUnused()
	im.localImageManager.cleanupDuplicateImages()

	log.Println("Image cleanup completed")
}
