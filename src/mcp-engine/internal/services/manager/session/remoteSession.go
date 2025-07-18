package session

import (
	"context"
	"io"
	"log"
	"sync"
	"time"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mtError"
	"google.golang.org/grpc"
)

const REMOTE_SESSION_INACTIVITY_TIMEOUT = time.Second * 60

type RemoteSession struct {
	sessionManager *Sessions

	storedSession          *state.Session
	lastSessionInteraction time.Time
	mutex                  sync.RWMutex
	connection             managerPb.McpManagerClient

	context context.Context
	cancel  context.CancelFunc
}

func newRemoteSession(
	sessions *Sessions,
	storedSession *state.Session,
	connection managerPb.McpManagerClient,
) *RemoteSession {
	ctx, cancel := context.WithCancel(context.Background())

	return &RemoteSession{
		sessionManager: sessions,

		storedSession:          storedSession,
		lastSessionInteraction: time.Now(),

		connection: connection,

		context: ctx,
		cancel:  cancel,
	}
}

func (s *RemoteSession) SendMcpMessage(req *managerPb.SendMcpMessageRequest, stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse]) *mterror.MTError {
	s.Touch()

	responseStream, err := s.connection.SendMcpMessage(s.context, req)
	if err != nil {
		log.Printf("Failed to send MCP message: %v", err)
		return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to send MCP message", err)
	}

	for {
		s.Touch()

		response, err := responseStream.Recv()
		if err != nil {
			if err == context.Canceled || err == io.EOF {
				return nil // Client has closed the stream
			}

			return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to receive MCP message response", err)
		}

		err = stream.Send(response)
		if err != nil {
			return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to send MCP message response to client", err)
		}
	}
}

func (s *RemoteSession) StreamMcpMessages(req *managerPb.StreamMcpMessagesRequest, stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse]) *mterror.MTError {
	s.Touch()

	responseStream, err := s.connection.StreamMcpMessages(s.context, req)
	if err != nil {
		return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to stream MCP messages", err)
	}

	go func() {
		touchTicker := time.NewTicker(time.Second * 15)
		defer touchTicker.Stop()

		for {
			select {
			case <-s.context.Done():
				return
			case <-touchTicker.C:
				s.Touch()
			}
		}
	}()

	for {
		response, err := responseStream.Recv()
		if err != nil {
			if err == context.Canceled || err == io.EOF {
				return nil // Client has closed the stream
			}

			return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to receive MCP message stream response", err)
		}

		err = stream.Send(response)
		if err != nil {
			return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to send MCP message stream response to client", err)
		}
	}
}

func (s *RemoteSession) GetServerInfo(req *managerPb.GetServerInfoRequest) (*mcpPb.McpParticipant, *mterror.MTError) {
	s.Touch()

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

	err = s.sessionManager.DiscardSession(s.storedSession.ID)
	if err != nil {
		return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to discard session", err)
	}

	return nil
}

func (s *RemoteSession) CanDiscard() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return s.connection == nil || time.Since(s.lastSessionInteraction) > REMOTE_SESSION_INACTIVITY_TIMEOUT
}

func (s *RemoteSession) StoredSession() *state.Session {
	return s.storedSession
}

func (s *RemoteSession) SessionRecord() (*db.Session, *mterror.MTError) {
	session, err := s.sessionManager.db.GetSessionById(s.storedSession.SessionUuid)
	if err != nil || session == nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to get session record", err)
	}

	return session, nil
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

func (s *RemoteSession) Touch() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.lastSessionInteraction = time.Now()
}
