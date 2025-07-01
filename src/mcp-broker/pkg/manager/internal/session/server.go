package session

import (
	"context"

	managerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/manager"
	"github.com/metorial/metorial/mcp-broker/gen/mcp-broker/mcp"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/state"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/workers"
	mterror "github.com/metorial/metorial/mcp-broker/pkg/mt-error"
	"google.golang.org/grpc"
)

type SessionServer struct {
	managerPb.UnimplementedMcpManagerServer

	state         *state.StateManager
	workerManager *workers.WorkerManager
	sessions      *Sessions
}

func NewSessionServer(
	state *state.StateManager,
	workerManager *workers.WorkerManager,
) *SessionServer {
	return &SessionServer{
		state:         state,
		workerManager: workerManager,
		sessions:      NewSessions(state, workerManager),
	}
}

func (s *SessionServer) CreateSession(ctx context.Context, req *managerPb.CreateSessionRequest) (*managerPb.CreateSessionResponse, error) {
	_, err := s.sessions.UpsertSession(req)
	if err != nil {
		return nil, err
	}

	return &managerPb.CreateSessionResponse{}, nil
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

	server, err := session.GetServerInfo(req)
	if err != nil {
		return nil, err.ToGRPCStatus().Err()
	}

	participant, gerr := server.ToPbParticipant()
	if gerr != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorCode, "failed to convert server to participant", gerr).ToGRPCStatus().Err()
	}

	return participant, nil
}
