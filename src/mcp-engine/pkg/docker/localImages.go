package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"sync"
	"time"
)

type localImage struct {
	CreatedAt  DockerTime `json:"CreatedAt"`
	Repository string     `json:"Repository"`
	Tag        string     `json:"Tag"`
	ID         string     `json:"ID"`
}

type localImageManager struct {
	imagesByRepository map[string][]*localImage
	imagesByID         map[string]*localImage
	imagesByFullName   map[string]*localImage

	imagePullLocks   map[string]*sync.Mutex
	imageRemoveLocks map[string]*sync.Mutex

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

func (m *localImageManager) pullImage(repository string, tag string) (*localImage, error) {
	fullName, err := m.getImageFullName(repository, tag)
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

func (m *localImageManager) getImageOrFallback(repository string, tag string) (*localImage, error) {
	fullName, err := m.getImageFullName(repository, tag)
	if err != nil {
		return nil, fmt.Errorf("error getting full image name: %w", err)
	}

	m.mu.RLock()
	image, imageExists := m.imagesByFullName[fullName]
	repositoryImages, repoExists := m.imagesByRepository[repository]
	m.mu.RUnlock()

	if imageExists {
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

		return currentImage, nil
	}

	return m.pullImage(repository, tag)
}

func (m *localImageManager) removeImage(imageId string) error {
	img, err := m.removeImageFromIndex(imageId)
	if err != nil {
		return fmt.Errorf("error removing image from index: %w", err)
	}

	cmd := exec.Command("docker", "image", "rm", img.ID)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to remove image %s: %w\nOutput: %s", img.ID, err, string(output))
	}

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

	m.imagesByFullName[fullName] = img
	m.imagesByID[img.ID] = img

	if _, exists := m.imagesByRepository[img.Repository]; !exists {
		m.imagesByRepository[img.Repository] = make([]*localImage, 0)
	}
	m.imagesByRepository[img.Repository] = append(m.imagesByRepository[img.Repository], img)
}

func (m *localImageManager) getImageFullName(repository, tag string) (string, error) {
	if repository == "" || tag == "" {
		return "", fmt.Errorf("repository and tag must be specified")
	}

	return fmt.Sprintf("%s:%s", repository, tag), nil
}
