package docker

import (
	"context"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"sync"
	"time"
)

const CleanupInterval = 5 * time.Minute

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

func (im *ImageManager) downloadImage(name string, tag *string) error {
	imageTag := "latest"
	if tag != nil {
		imageTag = *tag
	}

	fullName := fmt.Sprintf("%s:%s", name, imageTag)

	log.Printf("Pulling image %s", fullName)

	cmd := exec.Command("docker", "pull", fullName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to pull image %s: %w\nOutput: %s", fullName, err, string(output))
	}

	imageID, err := im.getImageID(fullName)
	if err != nil {
		return err
	}

	image := newDockerImage(name, imageTag, imageID)

	im.mu.Lock()
	im.images[fullName] = image
	im.mu.Unlock()

	log.Printf("Successfully downloaded image: %s\n", fullName)

	return nil
}

func (im *ImageManager) parseImageName(imageName string) (string, string, error) {
	parts := strings.Split(imageName, ":")

	switch len(parts) {
	case 1:
		return parts[0], "latest", nil
	case 2:
		return parts[0], parts[1], nil
	default:
		return "", "", fmt.Errorf("invalid image name format: %s", imageName)
	}
}

func (im *ImageManager) hasImage(imageName string) bool {
	im.mu.RLock()
	defer im.mu.RUnlock()

	_, exists := im.images[imageName]
	return exists
}

func (im *ImageManager) ensureImage(imageName string) error {
	if im.hasImage(imageName) {
		return nil
	}

	name, tag, err := im.parseImageName(imageName)
	if err != nil {
		return err
	}

	return im.downloadImage(name, &tag)
}

func (im *ImageManager) reportImageUse(imageName, containerID string) error {
	im.mu.RLock()
	image, exists := im.images[imageName]
	im.mu.RUnlock()

	if !exists {
		return nil
	}

	image.markUsed(containerID)
	return nil
}

func (im *ImageManager) listImages() []*ImageHandle {
	im.mu.RLock()
	defer im.mu.RUnlock()

	images := make([]*ImageHandle, 0, len(im.images))
	for _, image := range im.images {
		images = append(images, image)
	}

	return images
}

func (im *ImageManager) getImageID(imageName string) (string, error) {
	cmd := exec.Command("docker", "images", "--format", "{{.ID}}", imageName)
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get image ID for %s: %w", imageName, err)
	}

	imageID := strings.TrimSpace(string(output))
	if imageID == "" {
		return "", fmt.Errorf("image %s not found", imageName)
	}

	return imageID, nil
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
	cmd := exec.Command("docker", "rmi", imageName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to remove image %s: %w\nOutput: %s", imageName, err, string(output))
	}

	im.mu.Lock()
	delete(im.images, imageName)
	im.mu.Unlock()

	return nil
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

		ticker := time.NewTicker(CleanupInterval)
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

	fmt.Println("Image cleanup completed")
}
