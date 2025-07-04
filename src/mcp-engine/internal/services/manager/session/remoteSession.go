package session

import (
	"context"
	"sync"
	"time"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mt-error"
	"google.golang.org/grpc"
)

const REMOTE_SESSION_INACTIVITY_TIMEOUT = time.Second * 60

type RemoteSession struct {
	storedSession             *state.Session
	lastConnectionInteraction time.Time
	mutex                     sync.RWMutex
	connection                managerPb.McpManagerClient

	context context.Context
	cancel  context.CancelFunc
}

func (s *RemoteSession) SendMcpMessage(req *managerPb.SendMcpMessageRequest, stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse]) *mterror.MTError {
	s.touch()

	responseStream, err := s.connection.SendMcpMessage(s.context, req)
	if err != nil {
		return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to send MCP message", err)
	}

	for {
		s.touch()

		response, err := responseStream.Recv()
		if err != nil {
			if err == context.Canceled {
				return nil // Client has closed the stream
			}

			return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to receive MCP message response", err)
		}

		if err := stream.Send(response); err != nil {
			return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to send MCP message response to client", err)
		}
	}
}

func (s *RemoteSession) StreamMcpMessages(req *managerPb.StreamMcpMessagesRequest, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) *mterror.MTError {
	s.touch()

	responseStream, err := s.connection.StreamMcpMessages(s.context, req)
	if err != nil {
		return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to stream MCP messages", err)
	}

	for {
		s.touch()

		response, err := responseStream.Recv()
		if err != nil {
			if err == context.Canceled {
				return nil // Client has closed the stream
			}

			return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to receive MCP message stream response", err)
		}

		if err := stream.Send(response); err != nil {
			return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to send MCP message stream response to client", err)
		}
	}
}

func (s *RemoteSession) GetServerInfo(req *managerPb.GetServerInfoRequest) (*mcpPb.McpParticipant, *mterror.MTError) {
	s.touch()

	server, err := s.connection.GetServerInfo(s.context, req)
	if err != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to get server info", err)
	}

	if server == nil {
		return nil, mterror.NewWithDetails(mterror.NotFoundKind, "server not found", map[string]string{
			"session_id": s.storedSession.ID,
		})
	}

	return server, nil
}

func (s *RemoteSession) DiscardSession() *mterror.MTError {
	_, err := s.connection.DiscardSession(s.context, &managerPb.DiscardSessionRequest{
		SessionId: s.storedSession.ID,
	})
	if err != nil {
		return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to discard session", err)
	}

	return nil
}

func (s *RemoteSession) CanDiscard() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// If the last interaction with the connection was too long ago, we can discard it
	if time.Since(s.lastConnectionInteraction) > REMOTE_SESSION_INACTIVITY_TIMEOUT {
		return true
	}

	return false
}

func (s *RemoteSession) StoredSession() *state.Session {
	return s.storedSession
}

func (s *RemoteSession) stop(SessionStopType) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}

	return nil
}

func (s *RemoteSession) touch() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.lastConnectionInteraction = time.Now()
}
