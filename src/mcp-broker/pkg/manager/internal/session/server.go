package session

import (
	"context"

	managerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/manager"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/state"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/workers"
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
	// Implementation for sending MCP messages
	return nil
}

func (s *SessionServer) StreamMcpMessages(req *managerPb.StreamMcpMessagesRequest, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) error {
	// Implementation for streaming MCP messages
	return nil
}
