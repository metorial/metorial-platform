package docker

import (
	"context"
	"fmt"
	"log"
	"os/exec"
	"sync"
)

type Runtime string

const (
	RuntimeDocker Runtime = "docker"
)

type ContainerManager struct {
	runtime      Runtime
	imageManager *ImageManager
	containers   map[string]*ContainerHandle
	mutex        sync.RWMutex
	ctx          context.Context
	cancel       context.CancelFunc
}

type ContainerStartOptions struct {
	ID string

	ImageRef  string
	Env       map[string]string
	Args      []string
	Command   string
	MaxMemory string // Optional, e.g., "512m" or "1g"
	MaxCPU    string // Optional, e.g., "1" or "2"
}

func newContainerManager(runtime Runtime, imageManager *ImageManager) *ContainerManager {
	ctx, cancel := context.WithCancel(context.Background())

	m := &ContainerManager{
		runtime:      runtime,
		imageManager: imageManager,
		containers:   make(map[string]*ContainerHandle),
		ctx:          ctx,
		cancel:       cancel,
	}

	return m
}

func (m *ContainerManager) close() error {
	m.cancel()

	m.mutex.Lock()
	defer m.mutex.Unlock()

	for _, container := range m.containers {
		container.Stop()
	}

	return nil
}

func (m *ContainerManager) startContainer(opts *ContainerStartOptions) (*ContainerHandle, error) {
	if err := m.imageManager.ensureImage(opts.ImageRef); err != nil {
		return nil, fmt.Errorf("failed to update image usage: %w", err)
	}

	ctx, cancel := context.WithCancel(m.ctx)

	containerID := fmt.Sprintf("mtrc-%s", opts.ID)

	dockerArgs := []string{
		"run", "--interactive", "--rm",
		"--name", containerID,
		"--env", fmt.Sprintf("METORIAL_CONTAINER_ID=%s", containerID),
		"--env", "Metorial/Runner@2.0",
	}

	for key, value := range opts.Env {
		dockerArgs = append(dockerArgs, "--env", fmt.Sprintf("%s=%s", key, value))
	}

	if opts.MaxMemory != "" {
		dockerArgs = append(dockerArgs, "--memory", opts.MaxMemory)
	}

	if opts.MaxCPU != "" {
		dockerArgs = append(dockerArgs, "--cpus", opts.MaxCPU)
	}

	dockerArgs = append(dockerArgs, opts.ImageRef)

	if opts.Command != "" {
		dockerArgs = append(dockerArgs, opts.Command)
	}

	cmd := exec.CommandContext(ctx, "docker", dockerArgs...)

	log.Printf("Starting container for image %s with ID %s", opts.ImageRef, containerID)

	// Get stdin, stdout, stderr pipes
	stdin, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create stdin pipe: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		stdin.Close()
		cancel()
		return nil, fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		stdin.Close()
		stdout.Close()
		cancel()
		return nil, fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	// Start the container
	if err := cmd.Start(); err != nil {
		stdin.Close()
		stdout.Close()
		stderr.Close()
		cancel()
		return nil, fmt.Errorf("failed to start container: %w", err)
	}

	container := &ContainerHandle{
		ID:       containerID,
		ImageRef: opts.ImageRef,
		Running:  true,
		ExitCode: -1,

		cmd:     cmd,
		stdin:   stdin,
		stdout:  stdout,
		stderr:  stderr,
		done:    make(chan struct{}),
		cancel:  cancel,
		manager: m,
	}

	m.mutex.Lock()
	m.containers[containerID] = container
	m.mutex.Unlock()

	m.imageManager.reportImageUse(opts.ImageRef, containerID)

	go container.monitor()

	return container, nil
}

func (m *ContainerManager) stopContainer(containerID string) error {
	m.mutex.RLock()
	container, exists := m.containers[containerID]
	m.mutex.RUnlock()

	if !exists {
		return fmt.Errorf("container %s not found", containerID)
	}

	return container.Stop()
}

func (m *ContainerManager) listContainers() []*ContainerHandle {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	containers := make([]*ContainerHandle, 0, len(m.containers))
	for _, container := range m.containers {
		containers = append(containers, container)
	}

	return containers
}

func (m *ContainerManager) getContainer(containerID string) (*ContainerHandle, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()

	container, exists := m.containers[containerID]
	if !exists {
		return nil, fmt.Errorf("container %s not found", containerID)
	}

	return container, nil
}
