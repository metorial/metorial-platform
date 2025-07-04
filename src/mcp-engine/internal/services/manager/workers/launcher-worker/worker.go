package runner_worker

import (
	"context"
	"fmt"
	"log"
	"sync"

	launcherPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/launcher"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	base_worker "github.com/metorial/metorial/mcp-engine/internal/services/manager/workers/base-worker"
)

type LauncherWorker struct {
	*base_worker.BaseWorkerConnection

	client  launcherPb.LauncherClient
	manager *workers.WorkerManager

	mutex sync.Mutex
}

func NewLauncherWorker(ctx context.Context, manager *workers.WorkerManager, workerID string, address string) *LauncherWorker {
	res := &LauncherWorker{
		BaseWorkerConnection: base_worker.NewBaseWorkerConnection(ctx, workerID, address),

		manager: manager,
		client:  nil,
	}

	return res
}

func (rw *LauncherWorker) Start() error {
	log.Printf("Starting LauncherWorker %s at %s", rw.WorkerID(), rw.Address())

	rw.mutex.Lock()
	defer rw.mutex.Unlock()
	if rw.client != nil {
		return fmt.Errorf("LauncherWorker %s at %s is already started", rw.WorkerID(), rw.Address())
	}

	err := rw.BaseWorkerConnection.Start()
	if err != nil {
		return fmt.Errorf("failed to start BaseWorkerConnection: %w", err)
	}

	rw.client = launcherPb.NewLauncherClient(rw.BaseWorkerConnection.Conn())

	go rw.monitor()

	return nil
}

func (rw *LauncherWorker) Stop() error {
	log.Printf("Stopping LauncherWorker %s at %s", rw.WorkerID(), rw.Address())

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

func (rw *LauncherWorker) Type() workers.WorkerType {
	return workers.WorkerTypeLauncher
}

func (bw *LauncherWorker) RunLauncher(input *launcherPb.LauncherConfig) (*launcherPb.RunLauncherResponse, error) {
	if bw.client == nil {
		return nil, fmt.Errorf("LauncherClient is not initialized for worker %s at %s", bw.WorkerID(), bw.Address())
	}

	run, err := bw.client.RunLauncher(bw.Context(), &launcherPb.RunLauncherRequest{
		Config: input,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to run launcher: %w", err)
	}

	return run, nil
}

func (rw *LauncherWorker) monitor() {
	rw.mutex.Lock()
	if rw.client == nil {
		rw.mutex.Unlock()
		return // Not started
	}
	rw.mutex.Unlock()

	rw.BaseWorkerConnection.Wait()

	log.Printf("LauncherWorker %s at %s has stopped", rw.WorkerID(), rw.Address())

	rw.mutex.Lock()
	defer rw.mutex.Unlock()

	rw.manager.SelfUnregisterWorker(rw.WorkerID())
}
