package manager

import (
	"context"
	"fmt"
	"log"

	managerForWorkerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/managerForWorker"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/state"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/workers"
)

type managerForWorkerServer struct {
	managerForWorkerPb.UnimplementedMcpManagerForWorkerServer

	state         *state.StateManager
	workerManager *workers.WorkerManager
}

func (s *managerForWorkerServer) ListManagers(ctx context.Context, req *managerForWorkerPb.ListManagersRequest) (*managerForWorkerPb.ListManagersResponse, error) {
	managers, err := s.state.ListManagers()
	if err != nil {
		return nil, err
	}

	resManagers := make([]*managerForWorkerPb.Manager, 0, len(managers))
	for _, manager := range managers {
		resManagers = append(resManagers, &managerForWorkerPb.Manager{
			Id:      manager.ID,
			Address: manager.Address,
		})
	}

	return &managerForWorkerPb.ListManagersResponse{
		Managers: resManagers,
	}, nil
}

func (s *managerForWorkerServer) RegisterWorker(ctx context.Context, req *managerForWorkerPb.RegisterWorkerRequest) (*managerForWorkerPb.RegisterWorkerResponse, error) {
	if req.WorkerType == managerForWorkerPb.WorkerType_WORKER_TYPE_RUNNER {
		log.Printf("Registering worker %s of type %s at address %s", req.WorkerId, req.WorkerType, req.Address)

		runnerWorker := workers.NewRunnerWorker(req.WorkerId, req.Address)
		s.workerManager.RegisterWorker(runnerWorker)

		return &managerForWorkerPb.RegisterWorkerResponse{}, nil
	}

	return nil, fmt.Errorf("unsupported worker type: %v", req.WorkerType)
}
