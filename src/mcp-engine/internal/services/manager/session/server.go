package session

import (
	"context"
	"time"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	"github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	workerBrokerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/workerBroker"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mt-error"
	"github.com/metorial/metorial/mcp-engine/pkg/util"
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
	if req.Config.GetContainerRunConfigWithContainerArguments() == nil &&
		req.Config.GetContainerRunConfigWithLauncher() == nil &&
		req.Config.GetRemoteRunConfigWithLauncher() == nil &&
		req.Config.GetRemoteRunConfigWithServer() == nil {
		return nil, mterror.New(mterror.InvalidRequestKind, "session config must contain a run config").ToGRPCStatus().Err()
	}

	session, err := s.sessions.UpsertSession(req)
	if err != nil {
		return nil, err
	}

	dbSes, err := session.SessionRecord()
	if err != nil {
		return nil, err.ToGRPCStatus().Err()
	}

	pbSes, err2 := dbSes.ToPb()
	if err2 != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "unable to get session", err2).ToGRPCStatus().Err()
	}

	return &managerPb.CreateSessionResponse{
		SessionId: req.SessionId,
		Session:   pbSes,
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

func (s *SessionServer) ListRuns(ctx context.Context, req *managerPb.ListRunsRequest) (*managerPb.ListRunsResponse, error) {
	list, err := s.sessions.db.ListSessionRunsBySession(req.SessionId, req.Pagination, req.After)
	if err != nil {
		return nil, err
	}

	res, err := util.MapWithError(list, func(rec db.SessionRun) (*managerPb.EngineSessionRun, error) {
		return rec.ToPb()
	})
	if err != nil {
		return nil, err
	}

	return &managerPb.ListRunsResponse{Runs: res}, nil
}

func (s *SessionServer) GetRun(ctx context.Context, req *managerPb.GetRunRequest) (*managerPb.GetRunResponse, error) {
	rec, err := s.sessions.db.GetSessionRunById(req.RunId)
	if err != nil {
		return nil, err
	}

	res, err := rec.ToPb()
	if err != nil {
		return nil, err
	}

	return &managerPb.GetRunResponse{Run: res}, nil
}

func (s *SessionServer) ListSessions(ctx context.Context, req *managerPb.ListSessionsRequest) (*managerPb.ListSessionsResponse, error) {
	list, err := s.sessions.db.ListSessionsByExternalId(req.ExternalId, req.Pagination)
	if err != nil {
		return nil, err
	}

	res, err := util.MapWithError(list, func(rec db.Session) (*managerPb.EngineSession, error) {
		return rec.ToPb()
	})
	if err != nil {
		return nil, err
	}

	return &managerPb.ListSessionsResponse{Sessions: res}, nil
}

func (s *SessionServer) GetSession(ctx context.Context, req *managerPb.GetSessionRequest) (*managerPb.GetSessionResponse, error) {
	rec, err := s.sessions.db.GetSessionById(req.SessionId)
	if err != nil {
		return nil, err
	}

	res, err := rec.ToPb()
	if err != nil {
		return nil, err
	}

	return &managerPb.GetSessionResponse{Session: res}, nil
}

func (s *SessionServer) ListRunErrors(ctx context.Context, req *managerPb.ListRunErrorsRequest) (*managerPb.ListRunErrorsResponse, error) {
	list, err := s.sessions.db.ListSessionErrorsByRun(req.RunId, req.Pagination, req.After)
	if err != nil {
		return nil, err
	}

	res, err := util.MapWithError(list, func(rec db.SessionError) (*managerPb.EngineSessionError, error) {
		return rec.ToPb()
	})
	if err != nil {
		return nil, err
	}

	return &managerPb.ListRunErrorsResponse{Errors: res}, nil
}
func (s *SessionServer) ListRunEvents(ctx context.Context, req *managerPb.ListRunEventsRequest) (*managerPb.ListRunEventsResponse, error) {
	list, err := s.sessions.db.ListSessionEventsByRun(req.RunId, req.Pagination, req.After)
	if err != nil {
		return nil, err
	}

	res, err := util.MapWithError(list, func(rec db.SessionEvent) (*managerPb.EngineSessionEvent, error) {
		return rec.ToPb()
	})
	if err != nil {
		return nil, err
	}

	return &managerPb.ListRunEventsResponse{Events: res}, nil
}

func (s *SessionServer) ListRunMessages(ctx context.Context, req *managerPb.ListRunMessagesRequest) (*managerPb.ListRunMessagesResponse, error) {
	list, err := s.sessions.db.ListSessionMessagesByRun(req.RunId, req.Pagination, req.After)
	if err != nil {
		return nil, err
	}

	res, err := util.MapWithError(list, func(rec db.SessionMessage) (*managerPb.EngineSessionMessage, error) {
		return rec.ToPb()
	})
	if err != nil {
		return nil, err
	}

	return &managerPb.ListRunMessagesResponse{Messages: res}, nil
}

func (s *SessionServer) ListSessionErrors(ctx context.Context, req *managerPb.ListSessionErrorsRequest) (*managerPb.ListSessionErrorsResponse, error) {
	list, err := s.sessions.db.ListSessionErrorsBySession(req.SessionId, req.Pagination, req.After)
	if err != nil {
		return nil, err
	}

	res, err := util.MapWithError(list, func(rec db.SessionError) (*managerPb.EngineSessionError, error) {
		return rec.ToPb()
	})
	if err != nil {
		return nil, err
	}

	return &managerPb.ListSessionErrorsResponse{Errors: res}, nil
}

func (s *SessionServer) ListSessionEvents(ctx context.Context, req *managerPb.ListSessionEventsRequest) (*managerPb.ListSessionEventsResponse, error) {
	list, err := s.sessions.db.ListSessionEventsBySession(req.SessionId, req.Pagination, req.After)
	if err != nil {
		return nil, err
	}

	res, err := util.MapWithError(list, func(rec db.SessionEvent) (*managerPb.EngineSessionEvent, error) {
		return rec.ToPb()
	})
	if err != nil {
		return nil, err
	}

	return &managerPb.ListSessionEventsResponse{Events: res}, nil
}

func (s *SessionServer) ListSessionMessages(ctx context.Context, req *managerPb.ListSessionMessagesRequest) (*managerPb.ListSessionMessagesResponse, error) {
	list, err := s.sessions.db.ListSessionMessagesBySession(req.SessionId, req.Pagination, req.After)
	if err != nil {
		return nil, err
	}

	res, err := util.MapWithError(list, func(rec db.SessionMessage) (*managerPb.EngineSessionMessage, error) {
		return rec.ToPb()
	})
	if err != nil {
		return nil, err
	}

	return &managerPb.ListSessionMessagesResponse{Messages: res}, nil
}

func (s *SessionServer) GetError(ctx context.Context, req *managerPb.GetErrorRequest) (*managerPb.GetErrorResponse, error) {
	rec, err := s.sessions.db.GetSessionErrorById(req.ErrorId)
	if err != nil {
		return nil, err
	}

	res, err := rec.ToPb()
	if err != nil {
		return nil, err
	}

	return &managerPb.GetErrorResponse{Error: res}, nil
}

func (s *SessionServer) GetEvent(ctx context.Context, req *managerPb.GetEventRequest) (*managerPb.GetEventResponse, error) {
	rec, err := s.sessions.db.GetSessionEventById(req.EventId)
	if err != nil {
		return nil, err
	}

	res, err := rec.ToPb()
	if err != nil {
		return nil, err
	}

	return &managerPb.GetEventResponse{Event: res}, nil
}

func (s *SessionServer) GetMessage(ctx context.Context, req *managerPb.GetMessageRequest) (*managerPb.GetMessageResponse, error) {
	rec, err := s.sessions.db.GetSessionMessageById(req.MessageId)
	if err != nil {
		return nil, err
	}

	res, err := rec.ToPb()
	if err != nil {
		return nil, err
	}

	return &managerPb.GetMessageResponse{Message: res}, nil
}

func (s *SessionServer) ListRecentlyActiveRuns(ctx context.Context, req *managerPb.ListRecentlyActiveRunsRequest) (*managerPb.ListRecentlyActiveRunsResponse, error) {
	ids, err := s.sessions.db.ListRecentlyActiveSessionRuns(time.UnixMilli(req.Since))
	if err != nil {
		return nil, err
	}

	return &managerPb.ListRecentlyActiveRunsResponse{
		RunIds: ids,
	}, nil
}

func (s *SessionServer) ListRecentlyActiveSessions(ctx context.Context, req *managerPb.ListRecentlyActiveSessionsRequest) (*managerPb.ListRecentlyActiveSessionsResponse, error) {
	ids, err := s.sessions.db.ListRecentlyActiveSessions(time.UnixMilli(req.Since))
	if err != nil {
		return nil, err
	}

	return &managerPb.ListRecentlyActiveSessionsResponse{
		SessionIds: ids,
	}, nil
}

func (s *SessionServer) CheckActiveSession(ctx context.Context, req *managerPb.CheckActiveSessionRequest) (*managerPb.CheckActiveSessionResponse, error) {
	nulSes, err := s.sessions.GetSessionSafe(req.SessionId)
	if err != nil {
		return nil, err.ToGRPCStatus().Err()
	}

	if nulSes == nil {
		// No session found, return false
		return &managerPb.CheckActiveSessionResponse{
			IsActive:  false,
			SessionId: req.SessionId,
		}, nil
	}

	rec, err := nulSes.SessionRecord()
	if err != nil {
		return nil, err.ToGRPCStatus().Err()
	}

	recPb, err2 := rec.ToPb()
	if err2 != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to convert session record to protobuf", err).ToGRPCStatus().Err()
	}

	return &managerPb.CheckActiveSessionResponse{
		IsActive:  true,
		SessionId: req.SessionId,
		Session:   recPb,
	}, nil
}

func (s *SessionServer) ListServers(ctx context.Context, req *managerPb.ListServersRequest) (*managerPb.ListServersResponse, error) {
	list, err := s.sessions.db.ListServers(req.Pagination)
	if err != nil {
		return nil, err
	}

	res, err := util.MapWithError(list, func(rec db.Server) (*managerPb.EngineServer, error) {
		return rec.ToPb()
	})
	if err != nil {
		return nil, err
	}

	return &managerPb.ListServersResponse{Servers: res}, nil
}

func (s *SessionServer) GetServer(ctx context.Context, req *managerPb.GetServerRequest) (*managerPb.GetServerResponse, error) {
	rec, err := s.sessions.db.GetServerById(req.ServerId)
	if err != nil {
		return nil, err
	}

	res, err := rec.ToPb()
	if err != nil {
		return nil, err
	}

	return &managerPb.GetServerResponse{Server: res}, nil
}
