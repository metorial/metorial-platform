package runner_worker

import (
	"context"
	"fmt"
	"log"
	"sync"

	runnerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/runner"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	base_worker "github.com/metorial/metorial/mcp-engine/internal/services/manager/workers/base-worker"
)

type RunnerWorker struct {
	*base_worker.BaseWorkerConnection

	client  runnerPb.McpRunnerClient
	manager *workers.WorkerManager

	mutex sync.Mutex
}

func NewRunnerWorker(ctx context.Context, manager *workers.WorkerManager, workerID, address string, isStandalone bool) *RunnerWorker {
	res := &RunnerWorker{
		BaseWorkerConnection: base_worker.NewBaseWorkerConnection(ctx, workerID, address, isStandalone),

		manager: manager,
		client:  nil,
	}

	return res
}

func (rw *RunnerWorker) Start() error {
	log.Printf("Starting RunnerWorker %s at %s", rw.WorkerID(), rw.Address())

	rw.mutex.Lock()
	defer rw.mutex.Unlock()
	if rw.client != nil {
		return fmt.Errorf("RunnerWorker %s at %s is already started", rw.WorkerID(), rw.Address())
	}

	err := rw.BaseWorkerConnection.Start()
	if err != nil {
		return fmt.Errorf("failed to start BaseWorkerConnection: %w", err)
	}

	rw.client = runnerPb.NewMcpRunnerClient(rw.BaseWorkerConnection.Conn())

	go rw.monitor()

	return nil
}

func (rw *RunnerWorker) Stop() error {
	log.Printf("Stopping RunnerWorker %s at %s", rw.WorkerID(), rw.Address())

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

func (rw *RunnerWorker) Type() workers.WorkerType {
	return workers.WorkerTypeContainer
}

func (rw *RunnerWorker) monitor() {
	rw.mutex.Lock()
	if rw.client == nil {
		rw.mutex.Unlock()
		return // Not started
	}
	rw.mutex.Unlock()

	rw.BaseWorkerConnection.Wait()

	log.Printf("RunnerWorker %s at %s has stopped", rw.WorkerID(), rw.Address())

	rw.mutex.Lock()
	defer rw.mutex.Unlock()

	rw.manager.SelfUnregisterWorker(rw.WorkerID())
}
