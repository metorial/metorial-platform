package workers

import (
	"fmt"
	"sync"

	"github.com/metorial/metorial/mcp-broker/pkg/murmur3"
)

type WorkerType string

const (
	WorkerTypeRunner WorkerType = "runner"
)

type Worker interface {
	Type() WorkerType

	WorkerID() string
	Start() error
	Stop() error
	AcceptingJobs() bool
	Healthy() bool

	CreateConnection(input *WorkerConnectionInput) (WorkerConnection, error)
}

type WorkerManager struct {
	workers       map[string]Worker
	workersByType map[WorkerType][]string

	mutex sync.Mutex
}

func NewWorkerManager() *WorkerManager {
	return &WorkerManager{
		workers: make(map[string]Worker),
	}
}

func (wm *WorkerManager) RegisterWorker(worker Worker) error {
	wm.mutex.Lock()
	defer wm.mutex.Unlock()

	if _, exists := wm.workers[worker.WorkerID()]; exists {
		return nil
	}

	if err := worker.Start(); err != nil {
		return err
	}

	wm.workers[worker.WorkerID()] = worker

	return nil
}

func (wm *WorkerManager) GetWorker(workerID string) (Worker, bool) {
	wm.mutex.Lock()
	defer wm.mutex.Unlock()

	worker, exists := wm.workers[workerID]
	return worker, exists
}

func (wm *WorkerManager) ListWorkers() []Worker {
	wm.mutex.Lock()
	defer wm.mutex.Unlock()

	workersList := make([]Worker, 0, len(wm.workers))
	for _, worker := range wm.workers {
		workersList = append(workersList, worker)
	}

	return workersList
}

func (wm *WorkerManager) ListWorkersByType(workerType WorkerType) []Worker {
	wm.mutex.Lock()
	defer wm.mutex.Unlock()

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

func (wm *WorkerManager) PickWorkerByHash(workerType WorkerType, data []byte) (Worker, bool) {
	wm.mutex.Lock()
	defer wm.mutex.Unlock()

	workerIDs, exists := wm.workersByType[workerType]
	if !exists || len(workerIDs) == 0 {
		return nil, false
	}

	index := murmur3.PickByHashIndex(data, len(workerIDs))
	if index < 0 || index >= len(workerIDs) {
		index = 0 // I'm pretty sure this can't happen, but just in case
	}

	workerID := workerIDs[index]
	worker, exists := wm.workers[workerID]
	if !exists {
		return nil, false
	}

	return worker, true
}

func (wm *WorkerManager) GetConnectionHashForWorkerType(workerType WorkerType, input *WorkerConnectionInput) ([]byte, error) {
	if workerType == WorkerTypeRunner {
		return GetConnectionHashForRunnerWorker(input)
	}

	return nil, fmt.Errorf("unsupported worker type: %v", workerType)
}

func (wm *WorkerManager) removeWorker(workerID string) {
	wm.mutex.Lock()
	defer wm.mutex.Unlock()

	delete(wm.workers, workerID)
}
