package manager

import (
	"context"
	"fmt"
	"log"

	workerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/worker"
	workerBrokerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/workerBroker"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	launcherWorker "github.com/metorial/metorial/mcp-engine/internal/services/manager/workers/launcher-worker"
	remoteWorker "github.com/metorial/metorial/mcp-engine/internal/services/manager/workers/remote-worker"
	runnerWorker "github.com/metorial/metorial/mcp-engine/internal/services/manager/workers/runner-worker"
)

type workerBrokerServer struct {
	workerBrokerPb.UnimplementedMcpWorkerBrokerServer

	state         *state.StateManager
	workerManager *workers.WorkerManager
}

func (s *workerBrokerServer) ListManagers(ctx context.Context, req *workerBrokerPb.ListManagersRequest) (*workerBrokerPb.ListManagersResponse, error) {
	managers, err := s.state.ListManagers()
	if err != nil {
		return nil, err
	}

	resManagers := make([]*workerBrokerPb.Manager, 0, len(managers))
	for _, manager := range managers {
		resManagers = append(resManagers, &workerBrokerPb.Manager{
			Id:      manager.ID,
			Address: manager.Address,
		})
	}

	return &workerBrokerPb.ListManagersResponse{
		Managers: resManagers,
	}, nil
}

func (s *workerBrokerServer) RegisterWorker(ctx context.Context, req *workerBrokerPb.RegisterWorkerRequest) (*workerBrokerPb.RegisterWorkerResponse, error) {
	_, exiting := s.workerManager.GetWorker(req.WorkerId)
	if exiting {
		log.Printf("Worker %s already registered, ignoring registration request", req.WorkerId)
		return &workerBrokerPb.RegisterWorkerResponse{}, nil
	}

	var worker workers.Worker
	log.Printf("Registering worker %s of type %s at address %s", req.WorkerId, req.WorkerType, req.Address)

	switch req.WorkerType {

	case workerPb.WorkerType_mcp_runner:
		worker = runnerWorker.NewRunnerWorker(context.Background(), s.workerManager, req.WorkerId, req.Address)
	case workerPb.WorkerType_launcher:
		worker = launcherWorker.NewLauncherWorker(context.Background(), s.workerManager, req.WorkerId, req.Address)
	case workerPb.WorkerType_mcp_remote:
		worker = remoteWorker.NewRemoteWorker(context.Background(), s.workerManager, req.WorkerId, req.Address)
	default:
		return nil, fmt.Errorf("unsupported worker type: %v", req.WorkerType)

	}

	err := s.workerManager.RegisterWorker(worker)
	if err != nil {
		log.Printf("Failed to register worker %s: %v", req.WorkerId, err)
		return nil, fmt.Errorf("failed to register worker %s: %w", req.WorkerId, err)
	}

	return &workerBrokerPb.RegisterWorkerResponse{}, nil

}

func (s *workerBrokerServer) GetManagerInfo(ctx context.Context, req *workerBrokerPb.GetManagerInfoRequest) (*workerBrokerPb.GetManagerInfoResponse, error) {
	return &workerBrokerPb.GetManagerInfoResponse{
		Id:      s.state.ManagerID,
		Address: s.state.Address,
	}, nil
}
