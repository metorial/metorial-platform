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
	WorkerTypeRunner   WorkerType = "runner"
	WorkerTypeLauncher WorkerType = "launcher"
)

type Worker interface {
	Type() WorkerType

	WorkerID() string
	Address() string

	Start() error
	Stop() error
	IsAcceptingJobs() bool
	IsHealthy() bool

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

func (wm *WorkerManager) getWorkerOfTypeByIndex(workerType WorkerType, index int) (Worker, bool) {
	wm.mutex.RLock()
	defer wm.mutex.RUnlock()

	workerIDs, exists := wm.workersByType[workerType]
	if !exists || len(workerIDs) == 0 {
		return nil, false
	}

	if index < 0 || index >= len(workerIDs) {
		index = 0 // If the index is out of bounds, we default to the first worker.
	}

	workerID := workerIDs[index]
	worker, exists := wm.workers[workerID]
	if !exists {
		return nil, false
	}

	if !worker.IsHealthy() || !worker.IsAcceptingJobs() {
		// If the worker is not healthy or not accepting jobs, we need to choose another one.
		for range workerIDs {
			workerID = workerIDs[index]
			worker, exists = wm.workers[workerID]
			if exists && worker.IsHealthy() && worker.IsAcceptingJobs() {
				break
			}
		}
	}

	return worker, true
}

func (wm *WorkerManager) PickWorkerByHash(workerType WorkerType, data []byte) (Worker, bool) {
	wm.mutex.RLock()
	defer wm.mutex.RUnlock()

	workerIDs, exists := wm.workersByType[workerType]
	if !exists || len(workerIDs) == 0 {
		return nil, false
	}

	index := murmur3.PickByHashIndex(data, len(workerIDs))
	return wm.getWorkerOfTypeByIndex(workerType, index)
}

func (wm *WorkerManager) PickWorkerRandomly(workerType WorkerType) (Worker, bool) {
	wm.mutex.RLock()
	defer wm.mutex.RUnlock()

	workerIDs, exists := wm.workersByType[workerType]
	if !exists || len(workerIDs) == 0 {
		return nil, false
	}

	index := rand.Intn(len(workerIDs))
	return wm.getWorkerOfTypeByIndex(workerType, index)
}

func (wm *WorkerManager) GetConnectionHashForWorkerType(workerType WorkerType, input *WorkerConnectionInput) ([]byte, error) {
	if workerType == WorkerTypeRunner {
		if input.RunConfig == nil {
			return nil, fmt.Errorf("RunConfig is required to create a connection hash")
		}

		return []byte(input.RunConfig.Container.DockerImage), nil
	}

	return nil, fmt.Errorf("unsupported worker type: %v", workerType)
}

func (wm *WorkerManager) SelfUnregisterWorker(workerID string) {
	wm.mutex.Lock()
	defer wm.mutex.Unlock()

	delete(wm.workers, workerID)
}
