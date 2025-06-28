package manager

import (
	"context"
	"fmt"
	"log"

	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/state"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/workers"
	pb "github.com/metorial/metorial/mcp-broker/pkg/proto-mcp-manager"
)

type managerForWorkerServer struct {
	pb.UnimplementedMcpManagerForWorkerServer

	state   *state.StateManager
	workers *workers.WorkersManager
}

func (s *managerForWorkerServer) ListManagers(ctx context.Context, req *pb.ListManagersRequest) (*pb.ListManagersResponse, error) {
	managers, err := s.state.ListManagers()
	if err != nil {
		return nil, err
	}

	resManagers := make([]*pb.Manager, 0, len(managers))
	for _, manager := range managers {
		resManagers = append(resManagers, &pb.Manager{
			Id:      manager.ID,
			Address: manager.Address,
		})
	}

	return &pb.ListManagersResponse{
		Managers: resManagers,
	}, nil
}

func (s *managerForWorkerServer) RegisterWorker(ctx context.Context, req *pb.RegisterWorkerRequest) (*pb.RegisterWorkerResponse, error) {
	if req.WorkerType == pb.WorkerType_WORKER_TYPE_RUNNER {
		log.Printf("Registering worker %s of type %s at address %s", req.WorkerId, req.WorkerType, req.Address)

		runnerWorker := workers.NewRunnerWorker(req.WorkerId, req.Address)
		s.workers.RegisterWorker(runnerWorker)

		return &pb.RegisterWorkerResponse{}, nil
	}

	return nil, fmt.Errorf("unsupported worker type: %v", req.WorkerType)
}
