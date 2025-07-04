package session

import (
	"context"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	"github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	workerBrokerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/workerBroker"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mt-error"
	"google.golang.org/grpc"
)

type SessionServer struct {
	managerPb.UnimplementedMcpManagerServer

	state         *state.StateManager
	workerManager *workers.WorkerManager
	sessions      *Sessions
}

func NewSessionServer(
	db *db.DB,
	state *state.StateManager,
	workerManager *workers.WorkerManager,
) *SessionServer {
	return &SessionServer{
		state:         state,
		workerManager: workerManager,
		sessions:      NewSessions(db, state, workerManager),
	}
}

func (s *SessionServer) CreateSession(ctx context.Context, req *managerPb.CreateSessionRequest) (*managerPb.CreateSessionResponse, error) {
	if req.Config.GetRunConfigWithContainerArguments() == nil && req.Config.GetRunConfigWithLauncher() == nil {
		return nil, mterror.New(mterror.InvalidRequestKind, "session config must contain either RunConfigWithContainerArguments or RunConfigWithLauncher").ToGRPCStatus().Err()
	}

	_, dbSes, err := s.sessions.UpsertSession(req)
	if err != nil {
		return nil, err
	}

	if dbSes != nil {
		return &managerPb.CreateSessionResponse{
			SessionId:         req.SessionId,
			InternalSessionId: dbSes.ID,
		}, nil
	}

	return &managerPb.CreateSessionResponse{
		SessionId: req.SessionId,
	}, nil
}

func (s *SessionServer) SendMcpMessage(req *managerPb.SendMcpMessageRequest, stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse]) error {
	session, err := s.sessions.GetSessionUnsafe(req.SessionId)
	if err != nil {
		return err.ToGRPCStatus().Err()
	}

	err = session.SendMcpMessage(req, stream)
	if err != nil {
		return err.ToGRPCStatus().Err()
	}

	return nil
}

func (s *SessionServer) StreamMcpMessages(req *managerPb.StreamMcpMessagesRequest, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) error {
	session, err := s.sessions.GetSessionUnsafe(req.SessionId)
	if err != nil {
		return err.ToGRPCStatus().Err()
	}

	err = session.StreamMcpMessages(req, stream)
	if err != nil {
		return err.ToGRPCStatus().Err()
	}

	return nil
}

func (s *SessionServer) GetServerInfo(ctx context.Context, req *managerPb.GetServerInfoRequest) (*mcp.McpParticipant, error) {
	session, err := s.sessions.GetSessionUnsafe(req.SessionId)
	if err != nil {
		return nil, err.ToGRPCStatus().Err()
	}

	participant, err := session.GetServerInfo(req)
	if err != nil {
		return nil, err.ToGRPCStatus().Err()
	}

	return participant, nil
}

func (s *SessionServer) DiscardSession(ctx context.Context, req *managerPb.DiscardSessionRequest) (*managerPb.DiscardSessionResponse, error) {
	session, err := s.sessions.GetSessionUnsafe(req.SessionId)
	if err != nil {
		return nil, err.ToGRPCStatus().Err()
	}

	err = session.DiscardSession()
	if err != nil {
		return nil, err.ToGRPCStatus().Err()
	}

	return &managerPb.DiscardSessionResponse{}, nil
}

func (s *SessionServer) ListManagers(context.Context, *workerBrokerPb.ListManagersRequest) (*workerBrokerPb.ListManagersResponse, error) {
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

func (s *SessionServer) ListWorkers(context.Context, *managerPb.ListWorkersRequest) (*managerPb.ListWorkersResponse, error) {
	workers := s.workerManager.ListWorkers()

	resWorkers := make([]*managerPb.WorkerInfo, 0, len(workers))
	for _, worker := range workers {
		resWorkers = append(resWorkers, &managerPb.WorkerInfo{
			WorkerId:      worker.WorkerID(),
			Address:       worker.Address(),
			AcceptingRuns: worker.IsAcceptingJobs(),
			Healthy:       worker.IsHealthy(),
		})
	}

	return &managerPb.ListWorkersResponse{
		Workers: resWorkers,
	}, nil
}

func (s *SessionServer) Stop() error {
	return s.sessions.Stop()
}
