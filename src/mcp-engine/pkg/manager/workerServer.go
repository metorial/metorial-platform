package manager

import (
	"context"
	"fmt"
	"log"

	workerBrokerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/workerBroker"
	"github.com/metorial/metorial/mcp-engine/pkg/manager/internal/state"
	"github.com/metorial/metorial/mcp-engine/pkg/manager/internal/workers"
	runner_worker "github.com/metorial/metorial/mcp-engine/pkg/manager/internal/workers/runner"
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

	if req.WorkerType == workerBrokerPb.WorkerType_WORKER_TYPE_RUNNER {
		log.Printf("Registering worker %s of type %s at address %s", req.WorkerId, req.WorkerType, req.Address)

		runnerWorker := runner_worker.NewRunnerWorker(context.Background(), s.workerManager, req.WorkerId, req.Address)
		err := s.workerManager.RegisterWorker(runnerWorker)
		if err != nil {
			log.Printf("Failed to register worker %s: %v", req.WorkerId, err)
			return nil, fmt.Errorf("failed to register worker %s: %w", req.WorkerId, err)
		}

		return &workerBrokerPb.RegisterWorkerResponse{}, nil
	}

	return nil, fmt.Errorf("unsupported worker type: %v", req.WorkerType)
}
