package remote_worker

import (
	"context"
	"fmt"
	"log"
	"sync"

	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	base_worker "github.com/metorial/metorial/mcp-engine/internal/services/manager/workers/base-worker"
)

type RemoteWorker struct {
	*base_worker.BaseWorkerConnection

	client  remotePb.McpRemoteClient
	manager *workers.WorkerManager

	mutex sync.Mutex
}

func NewRemoteWorker(ctx context.Context, manager *workers.WorkerManager, workerID string, address string) *RemoteWorker {
	res := &RemoteWorker{
		BaseWorkerConnection: base_worker.NewBaseWorkerConnection(ctx, workerID, address),

		manager: manager,
		client:  nil,
	}

	return res
}

func (rw *RemoteWorker) Start() error {
	log.Printf("Starting RemoteWorker %s at %s", rw.WorkerID(), rw.Address())

	rw.mutex.Lock()
	defer rw.mutex.Unlock()
	if rw.client != nil {
		return fmt.Errorf("RemoteWorker %s at %s is already started", rw.WorkerID(), rw.Address())
	}

	err := rw.BaseWorkerConnection.Start()
	if err != nil {
		return fmt.Errorf("failed to start BaseWorkerConnection: %w", err)
	}

	rw.client = remotePb.NewMcpRemoteClient(rw.BaseWorkerConnection.Conn())

	go rw.monitor()

	return nil
}

func (rw *RemoteWorker) Stop() error {
	log.Printf("Stopping RemoteWorker %s at %s", rw.WorkerID(), rw.Address())

	rw.mutex.Lock()
	defer rw.mutex.Unlock()

	if rw.client == nil {
		return nil // Already stopped
	}

	err := rw.BaseWorkerConnection.Stop()
	if err != nil {
		return fmt.Errorf("failed to close BaseWorkerConnection: %w", err)
	}

	rw.client = nil
	return nil
}

func (rw *RemoteWorker) Type() workers.WorkerType {
	return workers.WorkerTypeRemote
}

func (rw *RemoteWorker) monitor() {
	rw.mutex.Lock()
	if rw.client == nil {
		rw.mutex.Unlock()
		return // Not started
	}
	rw.mutex.Unlock()

	rw.BaseWorkerConnection.Wait()

	log.Printf("RemoteWorker %s at %s has stopped", rw.WorkerID(), rw.Address())

	rw.mutex.Lock()
	defer rw.mutex.Unlock()

	rw.manager.SelfUnregisterWorker(rw.WorkerID())
}
