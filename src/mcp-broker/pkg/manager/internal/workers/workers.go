package workers

import (
	"sync"

	"github.com/metorial/metorial/mcp-broker/pkg/mcp"
	pb "github.com/metorial/metorial/mcp-broker/pkg/proto-mcp-runner"
)

type Worker interface {
	WorkerID() string
	Start() error
	Stop() error
	AcceptingJobs() bool
	Healthy() bool

	CreateConnection(input WorkerConnectionInput) (WorkerConnection, error)
}

type WorkerConnectionInput struct {
	RunConfig *pb.RunConfig
	MCPClient *mcp.MCPClient

	ConnectionID string
	SessionID    string
}

type WorkersManager struct {
	workers map[string]Worker
	mutex   sync.Mutex
}

func NewWorkersManager() *WorkersManager {
	return &WorkersManager{
		workers: make(map[string]Worker),
	}
}

func (wm *WorkersManager) RegisterWorker(worker Worker) error {
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

func (wm *WorkersManager) GetWorker(workerID string) (Worker, bool) {
	wm.mutex.Lock()
	defer wm.mutex.Unlock()

	worker, exists := wm.workers[workerID]
	return worker, exists
}

func (wm *WorkersManager) ListWorkers() []Worker {
	wm.mutex.Lock()
	defer wm.mutex.Unlock()

	workersList := make([]Worker, 0, len(wm.workers))
	for _, worker := range wm.workers {
		workersList = append(workersList, worker)
	}

	return workersList
}

func (wm *WorkersManager) removeWorker(workerID string) {
	wm.mutex.Lock()
	defer wm.mutex.Unlock()

	delete(wm.workers, workerID)
}
