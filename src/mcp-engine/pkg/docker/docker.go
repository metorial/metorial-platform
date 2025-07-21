package docker

type DockerManager struct {
	containerManager *ContainerManager
	imageManager     *ImageManager
}

func NewDockerManager(runtime Runtime) *DockerManager {
	imageManager := newImageManager()

	return &DockerManager{
		containerManager: newContainerManager(runtime, imageManager),
		imageManager:     imageManager,
	}
}

func (dm *DockerManager) Close() error {
	if err := dm.containerManager.close(); err != nil {
		return err
	}

	dm.imageManager.close()
	return nil
}

func (dm *DockerManager) StartContainer(opts *ContainerStartOptions) (*ContainerHandle, error) {
	return dm.containerManager.startContainer(opts)
}

func (dm *DockerManager) StopContainer(containerID string) error {
	return dm.containerManager.stopContainer(containerID)
}

func (dm *DockerManager) ListContainers() []*ContainerHandle {
	return dm.containerManager.listContainers()
}

func (dm *DockerManager) GetContainer(containerID string) (*ContainerHandle, error) {
	return dm.containerManager.getContainer(containerID)
}

func (dm *DockerManager) ListImages() []*localImage {
	return dm.imageManager.listImages()
}

func (dm *DockerManager) GetImage(imageName string) (*localImage, error) {
	return dm.imageManager.getImage(imageName)
}
