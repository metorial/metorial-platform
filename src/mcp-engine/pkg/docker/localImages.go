package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/metorial/metorial/modules/datastructures"
)

const IMAGE_USAGE_THRESHOLD = 75 // Percentage

type localImage struct {
	CreatedAt  DockerTime
	LastUsedAt time.Time

	Repository string
	Tag        string
	ID         string
}

func (li *localImage) FullName() string {
	return fmt.Sprintf("%s:%s", li.Repository, li.Tag)
}

type localImageManager struct {
	imagesByRepository map[string][]*localImage
	imagesByID         map[string]*localImage
	imagesByFullName   map[string]*localImage

	imagePullLocks   map[string]*sync.Mutex
	imageRemoveLocks map[string]*sync.Mutex

	OwnedImages datastructures.Set[string]

	context context.Context
	mu      sync.RWMutex
}

func newLocalImageManager(ctx context.Context) *localImageManager {
	res := &localImageManager{
		imagesByRepository: make(map[string][]*localImage),
		imagesByID:         make(map[string]*localImage),
		imagesByFullName:   make(map[string]*localImage),

		context: ctx,

		imagePullLocks:   make(map[string]*sync.Mutex),
		imageRemoveLocks: make(map[string]*sync.Mutex),
	}

	go res.monitor()

	return res
}

func getLocalImages() ([]localImage, error) {
	cmd := exec.Command("docker", "images", "--format", "{{json .}}")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to list local images: %w\nOutput: %s", err, string(output))
	}

	lines := strings.Split(string(output), "\n")
	var images []localImage

	for _, line := range lines {
		if line == "" {
			continue
		}

		var img localImage
		if err := json.Unmarshal([]byte(line), &img); err != nil {
			return nil, fmt.Errorf("failed to parse image line: %s\nError: %w", line, err)
		}

		img.LastUsedAt = img.CreatedAt.Time

		images = append(images, img)
	}

	return images, nil
}

func (m *localImageManager) updateImages() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	images, err := getLocalImages()
	if err != nil {
		return fmt.Errorf("error fetching local images: %w", err)
	}

	m.imagesByRepository = make(map[string][]*localImage)
	m.imagesByID = make(map[string]*localImage)
	m.imagesByFullName = make(map[string]*localImage)

	for _, img := range images {
		m.setImageWithoutMutex(&img)
	}

	return nil
}

func (m *localImageManager) monitor() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	m.updateImages()

	for {
		select {
		case <-ticker.C:
			if err := m.updateImages(); err != nil {
				log.Printf("Error updating local images: %v\n", err)
			}
		case <-m.context.Done():
			log.Println("Stopping local image manager monitor")
			return
		}
	}
}

func (m *localImageManager) pullImage(repository, tag string) (*localImage, error) {
	fullName, err := getImageFullName(repository, tag)
	if err != nil {
		return nil, fmt.Errorf("error getting full image name: %w", err)
	}

	if _, exists := m.imagePullLocks[fullName]; !exists {
		m.imagePullLocks[fullName] = &sync.Mutex{}
	}
	m.imagePullLocks[fullName].Lock()
	defer m.imagePullLocks[fullName].Unlock()

	if image, exists := m.imagesByFullName[fullName]; exists {
		log.Printf("Image %s already exists, skipping pull\n", fullName)
		return image, nil
	}

	log.Printf("Pulling image %s", fullName)

	cmd := exec.Command("docker", "pull", fullName)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to pull image %s: %w\nOutput: %s", fullName, err, string(output))
	}

	// After pulling, we need to update the local image index
	cmd = exec.Command("docker", "images", "--format", "{{json .}}", fullName)
	output, err = cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to list pulled image %s: %w\nOutput: %s", fullName, err, string(output))
	}

	var img localImage
	if err := json.Unmarshal(output, &img); err != nil {
		return nil, fmt.Errorf("failed to parse pulled image output: %s\nError: %w", string(output), err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.setImageWithoutMutex(&img)

	log.Printf("Successfully pulled image: %s\n", fullName)

	return &img, nil
}

func (m *localImageManager) getImageOrFallback(repository, tag string) (*localImage, error) {
	fullName, err := getImageFullName(repository, tag)
	if err != nil {
		return nil, fmt.Errorf("error getting full image name: %w", err)
	}

	m.mu.RLock()
	image, imageExists := m.imagesByFullName[fullName]
	repositoryImages, repoExists := m.imagesByRepository[repository]
	m.mu.RUnlock()

	if imageExists {
		image.LastUsedAt = time.Now()
		return image, nil
	}

	if repoExists && len(repositoryImages) > 0 {
		currentImage := repositoryImages[0]

		for _, img := range repositoryImages {
			if img.CreatedAt.After(currentImage.CreatedAt.Time) {
				currentImage = img
			}
		}

		// Even if we have a fallback image, we still want to pull the latest one
		go func() {
			_, err := m.pullImage(repository, tag)
			if err != nil {
				log.Printf("Error pulling latest image for %s:%s: %v\n", repository, tag, err)
			}
		}()

		currentImage.LastUsedAt = time.Now()
		return currentImage, nil
	}

	return m.pullImage(repository, tag)
}

func (m *localImageManager) removeImage(imageId string) error {
	img, err := m.removeImageFromIndex(imageId)
	if err != nil {
		return fmt.Errorf("error removing image from index: %w", err)
	}

	go func() {
		cmd := exec.Command("docker", "image", "rm", img.ID)
		output, err := cmd.CombinedOutput()
		if err != nil {
			log.Printf("Error removing image %s: %v\nOutput: %s\n", img.ID, err, string(output))
		}
	}()

	return nil
}

func (m *localImageManager) removeImageFromIndex(imageId string) (*localImage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	image, exists := m.imagesByID[imageId]
	if !exists {
		return nil, fmt.Errorf("image with ID %s not found", imageId)
	}

	delete(m.imagesByID, imageId)

	fullName := fmt.Sprintf("%s:%s", image.Repository, image.Tag)
	delete(m.imagesByFullName, fullName)

	repository := image.Repository
	images, exists := m.imagesByRepository[repository]
	if exists {
		for i, img := range images {
			if img.ID == imageId {
				m.imagesByRepository[repository] = append(images[:i], images[i+1:]...)
				break
			}
		}

		if len(m.imagesByRepository[repository]) == 0 {
			delete(m.imagesByRepository, repository)
		}
	}

	return image, nil
}

func (m *localImageManager) setImageWithoutMutex(img *localImage) {
	fullName := fmt.Sprintf("%s:%s", img.Repository, img.Tag)

	if current, exists := m.imagesByFullName[fullName]; exists {
		current.CreatedAt = img.CreatedAt
		current.Repository = img.Repository
		current.Tag = img.Tag
		current.ID = img.ID

		if img.LastUsedAt.After(current.LastUsedAt) {
			current.LastUsedAt = img.LastUsedAt
		}

		return
	}

	m.imagesByFullName[fullName] = img
	m.imagesByID[img.ID] = img
	m.OwnedImages.Add(img.Repository)

	if _, exists := m.imagesByRepository[img.Repository]; !exists {
		m.imagesByRepository[img.Repository] = make([]*localImage, 0)
	}
	m.imagesByRepository[img.Repository] = append(m.imagesByRepository[img.Repository], img)
}

func (m *localImageManager) listImages() []*localImage {
	m.mu.RLock()
	defer m.mu.RUnlock()

	images := make([]*localImage, 0, len(m.imagesByFullName))
	for _, img := range m.imagesByFullName {
		images = append(images, img)
	}

	return images
}

func (m *localImageManager) getImage(imageId string) (*localImage, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	image, exists := m.imagesByID[imageId]
	if !exists {
		return nil, fmt.Errorf("image with ID %s not found", imageId)
	}

	return image, nil
}

func (m *localImageManager) isOwnedImage(repository string) bool {
	if strings.HasPrefix(repository, "ghcr.io/metorial/mcp-container--") {
		return true // We always own MCP container images
	}

	return m.OwnedImages.Contains(repository)
}

func (m *localImageManager) cleanupDuplicateImages() {
	for repository, images := range m.imagesByRepository {
		if len(images) <= 1 || !m.isOwnedImage(repository) {
			continue // No duplicates to clean up
		}

		sort.Slice(images, func(i, j int) bool {
			return images[i].CreatedAt.Time.Before(images[j].CreatedAt.Time)
		})

		// Keep the most recent image, and all images that
		// have been used in the last 15 minutes
		threshold := time.Now().Add(-15 * time.Minute)
		keptImages := make([]*localImage, 0, len(images))
		for _, img := range images {
			if img.LastUsedAt.After(threshold) || img == images[len(images)-1] {
				keptImages = append(keptImages, img)
			} else {
				go func() {
					err := m.removeImage(img.ID)
					if err != nil {
						log.Printf("Error removing image %s: %v\n", img.ID, err)
					}
				}()
			}
		}

		m.mu.Lock()
		m.imagesByRepository[repository] = keptImages
		if len(keptImages) == 0 {
			delete(m.imagesByRepository, repository)
		}
		m.mu.Unlock()
	}
}

func (m *localImageManager) cleanupUnused() {
	usage, err := GetSystemStorageUsage()
	if err != nil {
		log.Printf("Error getting system storage usage: %v\n", err)
		return
	}

	if usage < IMAGE_USAGE_THRESHOLD {
		log.Println("System storage usage is below threshold, no cleanup needed")
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Remove old images until we are below the threshold
	sortedImages := make([]*localImage, 0, len(m.imagesByFullName))
	for _, img := range m.imagesByFullName {
		sortedImages = append(sortedImages, img)
	}
	sort.Slice(sortedImages, func(i, j int) bool {
		return sortedImages[i].LastUsedAt.Before(sortedImages[j].LastUsedAt)
	})

	for _, img := range sortedImages {
		if img.LastUsedAt.Before(time.Now().Add(-30 * 24 * time.Hour)) { // 30 days old
			go func() {
				err := m.removeImage(img.ID)
				if err != nil {
					log.Printf("Error removing image %s: %v\n", img.ID, err)
				}
			}()
		}

		// Check if we are below the threshold after each removal
		currentUsage, err := GetSystemStorageUsage()
		if err != nil {
			log.Printf("Error getting system storage usage during cleanup: %v\n", err)
			break
		}

		if currentUsage < IMAGE_USAGE_THRESHOLD {
			log.Println("Cleanup complete, system storage usage is below threshold")
			break
		}
	}
}
