package workers

import (
	"sync"

	mcp_runner_client "github.com/metorial/metorial/mcp-broker/pkg/mcp-runner-client"
	pb "github.com/metorial/metorial/mcp-broker/pkg/proto-mcp-runner"
)

type RunnerWorker struct {
	workerID string
	address  string

	acceptingRuns bool
	healthy       bool

	client  *mcp_runner_client.McpRunnerClient
	manager *WorkersManager

	mutex sync.Mutex
	wg    sync.WaitGroup
}

func NewRunnerWorker(workerID, address string) *RunnerWorker {
	return &RunnerWorker{
		workerID: workerID,
		address:  address,

		client: nil,
	}
}

func (rw *RunnerWorker) WorkerID() string {
	return rw.workerID
}

func (rw *RunnerWorker) Start() error {
	rw.mutex.Lock()
	defer rw.mutex.Unlock()

	if rw.client != nil {
		return nil // Already started
	}

	client, err := mcp_runner_client.NewMcpRunnerClient(rw.address)
	if err != nil {
		return err
	}

	rw.client = client

	go rw.monitor()
	rw.registerListeners()

	return nil
}

func (rw *RunnerWorker) Stop() error {
	rw.mutex.Lock()
	defer rw.mutex.Unlock()

	if rw.client == nil {
		return nil // Already stopped
	}

	if err := rw.client.Close(); err != nil {
		return err
	}

	rw.client = nil
	return nil
}

func (rw *RunnerWorker) AcceptingJobs() bool {
	return rw.acceptingRuns
}

func (rw *RunnerWorker) Healthy() bool {
	return rw.healthy
}

func (rw *RunnerWorker) monitor() {
	rw.wg.Add(1)
	defer rw.wg.Done()

	if rw.client == nil {
		return // Not started
	}

	rw.client.Wait()

	rw.mutex.Lock()
	defer rw.mutex.Unlock()

	rw.manager.removeWorker(rw.workerID)
}

func (rw *RunnerWorker) registerListeners() {
	go rw.client.StreamRunnerHealth(func(rhr *pb.RunnerHealthResponse) {
		rw.mutex.Lock()
		defer rw.mutex.Unlock()

		rw.acceptingRuns = rhr.AcceptingRuns == pb.RunnerAcceptingJobs_ACCEPTING
		rw.healthy = rhr.Status == pb.RunnerStatus_HEALTHY
	})
}
