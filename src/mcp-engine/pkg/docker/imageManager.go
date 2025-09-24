package docker

import (
	"context"
	"fmt"
	"log"
	"slices"
	"sync"
	"time"

	"github.com/metorial/metorial/mcp-engine/pkg/rendezvous"
)

const CLEANUP_INTERVAL = time.Minute * 5
const IMAGE_MANAGER_LOCAL_KEY = "<local>"

type ImageManager struct {
	images map[string]*ImageHandle
	mu     sync.RWMutex
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	localImageManager map[string]*localImageManager
	imageToHost       map[string]*string

	ExternalHostMetorialServiceName   string
	ExternalHostMetorialServiceBroker string
	ExternalHostMetorialListToken     string
	ExternalHostPrivateKey            string
}

type ImageManagerCreateOptions struct {
	ExternalHostMetorialServiceName   string
	ExternalHostMetorialServiceBroker string
	ExternalHostMetorialListToken     string
	ExternalHostPrivateKey            string
}

func newImageManager(opts ImageManagerCreateOptions) *ImageManager {
	ctx, cancel := context.WithCancel(context.Background())

	manager := &ImageManager{
		images: make(map[string]*ImageHandle),
		ctx:    ctx,
		cancel: cancel,

		localImageManager: make(map[string]*localImageManager),

		ExternalHostMetorialServiceName:   opts.ExternalHostMetorialServiceName,
		ExternalHostMetorialServiceBroker: opts.ExternalHostMetorialServiceBroker,
		ExternalHostMetorialListToken:     opts.ExternalHostMetorialListToken,
		ExternalHostPrivateKey:            opts.ExternalHostPrivateKey,
	}

	manager.startCleanupTask()
	return manager
}

func (im *ImageManager) close() {
	im.cancel()
	im.wg.Wait()
}

func (im *ImageManager) ensureImage(ctx context.Context, repository, tag string) (*ImageHandle, error) {
	imageName := fmt.Sprintf("%s:%s", repository, tag)

	selectedHost := im.imageToHost[imageName]

	if im.ExternalHostMetorialServiceName != "" &&
		im.ExternalHostMetorialServiceBroker != "" &&
		im.ExternalHostMetorialListToken != "" &&
		im.ExternalHostPrivateKey != "" {
		hosts := Broker.ListRemoteHosts(
			im.ExternalHostMetorialServiceBroker,
			im.ExternalHostMetorialServiceName,
			im.ExternalHostMetorialListToken,
		)

		if len(hosts) < 1 {
			log.Printf("No remote hosts available from broker %s for service %s", im.ExternalHostMetorialServiceBroker, im.ExternalHostMetorialServiceName)
			return nil, fmt.Errorf("no remote hosts available from broker %s for service %s", im.ExternalHostMetorialServiceBroker, im.ExternalHostMetorialServiceName)
		}

		if selectedHost == nil || !slices.Contains(hosts, *selectedHost) {
			selectedHostLocal := rendezvous.PickElementConsistently(imageName, hosts)
			selectedHost = &selectedHostLocal
		}
	}

	im.mu.Lock()
	defer im.mu.Unlock()

	imageManagerKey := IMAGE_MANAGER_LOCAL_KEY
	if selectedHost != nil {
		imageManagerKey = *selectedHost
	}

	imageManager, exists := im.localImageManager[imageManagerKey]
	if !exists {
		opts := localImageManagerCreateOptions{}
		if selectedHost != nil {
			opts.ExternalHost = *selectedHost
			opts.ExternalHostPrivateKey = im.ExternalHostPrivateKey
		}

		imageManager = newLocalImageManager(opts, im.ctx)
		im.localImageManager[imageManagerKey] = imageManager
	}

	localImage, err := imageManager.getImageOrFallback(ctx, repository, tag)
	if err != nil {
		return nil, fmt.Errorf("failed to get local image: %w", err)
	}

	handle, exists := im.images[imageName]
	if !exists {
		handle = newDockerImage(localImage.Repository, localImage.Tag, localImage.ID)
		im.images[imageName] = handle
	}

	handle.ImageID = localImage.ID
	handle.ExternalHost = selectedHost
	handle.markUsed()

	localImage.LastUsedAt = time.Now()

	return handle, nil
}

func (im *ImageManager) ensureImageByFullName(ctx context.Context, fullName string) (*ImageHandle, error) {
	repository, tag, err := parseImageFullName(fullName)
	if err != nil {
		return nil, fmt.Errorf("failed to parse image full name: %w", err)
	}

	return im.ensureImage(ctx, repository, tag)
}

// func (im *ImageManager) listImages() []*localImage {
// 	return im.localImageManager.listImages()
// }

// func (im *ImageManager) getImage(imageId string) (*localImage, error) {
// 	return im.localImageManager.getImage(imageId)
// }

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

	for _, im := range im.localImageManager {
		im.cleanupUnused()
		im.cleanupDuplicateImages()
	}

	log.Println("Image cleanup completed")
}
