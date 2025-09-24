package workers

import (
	"fmt"
	"math/rand"
	"sync"

	launcherPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/launcher"
	"github.com/metorial/metorial/mcp-engine/pkg/murmur3"
)

type WorkerType string

const (
	WorkerTypeContainer WorkerType = "container"
	WorkerTypeLauncher  WorkerType = "launcher"
	WorkerTypeRemote    WorkerType = "remote"
)

type Worker interface {
	Type() WorkerType

	WorkerID() string
	Address() string

	Start() error
	Stop() error
	IsAcceptingJobs() bool
	IsHealthy() bool
	IsStandalone() bool

	CreateConnection(input *WorkerConnectionInput) (WorkerConnection, error)
	RunLauncher(input *launcherPb.LauncherConfig) (*launcherPb.RunLauncherResponse, error)
}

type WorkerManager struct {
	workers       map[string]Worker
	workersByType map[WorkerType][]string

	mutex sync.RWMutex
}

func NewWorkerManager() *WorkerManager {
	return &WorkerManager{
		workers:       make(map[string]Worker),
		workersByType: make(map[WorkerType][]string),

		mutex: sync.RWMutex{},
	}
}

func (wm *WorkerManager) RegisterWorker(worker Worker) error {
	wm.mutex.Lock()
	defer wm.mutex.Unlock()

	_, exists := wm.workers[worker.WorkerID()]
	if exists {
		return nil
	}

	err := worker.Start()
	if err != nil {
		return err
	}

	wm.workers[worker.WorkerID()] = worker

	workerType := worker.Type()
	if _, exists := wm.workersByType[workerType]; !exists {
		wm.workersByType[workerType] = []string{}
	}
	wm.workersByType[workerType] = append(wm.workersByType[workerType], worker.WorkerID())

	return nil
}

func (wm *WorkerManager) GetWorker(workerID string) (Worker, bool) {
	wm.mutex.RLock()
	defer wm.mutex.RUnlock()

	worker, exists := wm.workers[workerID]
	return worker, exists
}

func (wm *WorkerManager) ListWorkers() []Worker {
	wm.mutex.RLock()
	defer wm.mutex.RUnlock()

	workersList := make([]Worker, 0, len(wm.workers))
	for _, worker := range wm.workers {
		workersList = append(workersList, worker)
	}

	return workersList
}

func (wm *WorkerManager) ListWorkersByType(workerType WorkerType) []Worker {
	wm.mutex.RLock()
	defer wm.mutex.RUnlock()

	workerIDs, exists := wm.workersByType[workerType]
	if !exists {
		return nil
	}

	workersList := make([]Worker, 0, len(workerIDs))
	for _, workerID := range workerIDs {
		if worker, exists := wm.workers[workerID]; exists {
			workersList = append(workersList, worker)
		}
	}

	return workersList
}

func (wm *WorkerManager) getWorkerOfTypeByIndexOrFallback(workerType WorkerType, index int) (Worker, bool) {
	wm.mutex.RLock()
	defer wm.mutex.RUnlock()

	workerIDs, exists := wm.workersByType[workerType]
	if !exists || len(workerIDs) == 0 {
		return nil, false
	}

	if index < 0 || index >= len(workerIDs) {
		index = 0 // If the index is out of bounds, we default to the first worker.
	}

	for i := range workerIDs {
		// Start at index but wrap around to ensure we check all workers.
		workerID := workerIDs[(index+i)%len(workerIDs)]

		worker, exists := wm.workers[workerID]
		if !exists {
			continue // If the worker does not exist, skip to the next one.
		}

		if !worker.IsHealthy() || !worker.IsAcceptingJobs() {
			continue // If the worker is not healthy or not accepting jobs, skip to the next one.
		}

		return worker, true
	}

	return nil, false
}

func (wm *WorkerManager) PickWorkerByHash(workerType WorkerType, data []byte) (Worker, bool) {
	wm.mutex.RLock()
	defer wm.mutex.RUnlock()

	workerIDs, exists := wm.workersByType[workerType]
	if !exists || len(workerIDs) == 0 {
		return nil, false
	}

	index := murmur3.PickByHashIndex(data, len(workerIDs))
	return wm.getWorkerOfTypeByIndexOrFallback(workerType, index)
}

func (wm *WorkerManager) PickWorkerRandomly(workerType WorkerType) (Worker, bool) {
	wm.mutex.RLock()
	defer wm.mutex.RUnlock()

	workerIDs, exists := wm.workersByType[workerType]
	if !exists || len(workerIDs) == 0 {
		return nil, false
	}

	index := rand.Intn(len(workerIDs))
	return wm.getWorkerOfTypeByIndexOrFallback(workerType, index)
}

func (wm *WorkerManager) GetConnectionHashForWorkerType(workerType WorkerType, input *WorkerConnectionInput) ([]byte, error) {
	switch workerType {

	case WorkerTypeContainer:
		if input.ContainerRunConfig == nil {
			return nil, fmt.Errorf("ContainerRunConfig is required to create a connection hash")
		}

		return []byte(input.ContainerRunConfig.Container.DockerImage), nil

	case WorkerTypeRemote:
		if input.RemoteRunConfig == nil {
			return nil, fmt.Errorf("RemoteRunConfig is required to create a connection hash")
		}

		return []byte(input.RemoteRunConfig.Server.ServerUri), nil

	}

	return nil, fmt.Errorf("unsupported worker type: %v", workerType)
}

func (wm *WorkerManager) SelfUnregisterWorker(workerID string) {
	wm.mutex.Lock()
	defer wm.mutex.Unlock()

	worker, exists := wm.workers[workerID]
	if !exists {
		return
	}

	if worker.IsStandalone() {
		// Standalone workers should not be unregistered.
		return
	}

	delete(wm.workers, workerID)

	for workerType, workerIDs := range wm.workersByType {
		for i, id := range workerIDs {
			if id == workerID {
				wm.workersByType[workerType] = append(workerIDs[:i], workerIDs[i+1:]...)
				break
			}
		}

		if len(wm.workersByType[workerType]) == 0 {
			delete(wm.workersByType, workerType)
		}
	}

	go worker.Stop()
}
