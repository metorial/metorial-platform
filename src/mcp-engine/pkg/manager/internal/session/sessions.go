package session

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/limiter"
	"github.com/metorial/metorial/mcp-engine/pkg/lock"
	"github.com/metorial/metorial/mcp-engine/pkg/manager/internal/launcher"
	"github.com/metorial/metorial/mcp-engine/pkg/manager/internal/state"
	"github.com/metorial/metorial/mcp-engine/pkg/manager/internal/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mt-error"
	"google.golang.org/grpc"
)

type Session interface {
	// AcceptMessage(message *mcp.MCPMessage) error
	// Messages() <-chan mcp.MCPMessage
	// Output() <-chan *mcpPb.McpOutput
	// Errors() <-chan *mcpPb.McpError

	SendMcpMessage(req *managerPb.SendMcpMessageRequest, stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse]) *mterror.MTError
	StreamMcpMessages(req *managerPb.StreamMcpMessagesRequest, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) *mterror.MTError
	GetServerInfo(req *managerPb.GetServerInfoRequest) (*mcpPb.McpParticipant, *mterror.MTError)
	StoredSession() *state.Session
	DiscardSession() *mterror.MTError

	CanDiscard() bool
	stop() error
}

type Sessions struct {
	sessions map[string]Session

	state         *state.StateManager
	workerManager *workers.WorkerManager
	managers      *OtherManagers

	keylock     *lock.KeyLock
	pingLimiter *limiter.Limiter
	mutex       sync.RWMutex

	launcher *launcher.Launcher
}

func NewSessions(
	state *state.StateManager,
	workerManager *workers.WorkerManager,
) *Sessions {
	sessions := &Sessions{
		sessions:      make(map[string]Session),
		state:         state,
		workerManager: workerManager,
		managers:      NewOtherManagers(state),
		keylock:       lock.NewKeyLock(),
		pingLimiter:   limiter.NewLimiter(100), // Max 100 ping updates at a time
		launcher:      launcher.NewLauncher(workerManager),
	}

	go sessions.discardRoutine()
	go sessions.pingRoutine()

	return sessions
}

func (s *Sessions) GetSession(sessionId string) Session {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return s.sessions[sessionId]
}

func (s *Sessions) GetSessionUnsafe(sessionId string) (Session, *mterror.MTError) {
	if sessionId == "" {
		return nil, mterror.New(mterror.InvalidRequestKind, "session ID cannot be empty")
	}

	session := s.GetSession(sessionId)
	if session == nil {
		return nil, mterror.NewWithDetails(mterror.NotFoundKind, "session not found", map[string]string{
			"session_id": sessionId,
		})
	}

	return session, nil
}

func (s *Sessions) UpsertSession(
	request *managerPb.CreateSessionRequest,
) (Session, *mterror.MTError) {
	existing := s.GetSession(request.SessionId)
	if existing != nil {
		return existing, nil
	}

	s.keylock.Lock(request.SessionId)
	defer s.keylock.Unlock(request.SessionId)

	client, err := mcp.ParseMcpClient([]byte(request.McpClient.ParticipantJson))
	if err != nil {
		return nil, mterror.NewWithInnerError(mterror.InvalidRequestKind, "failed to parse MCP client", err)
	}

	storedSession, err := s.state.UpsertSession(
		request.SessionId,
		s.state.ManagerID,
	)
	if err != nil {
		// return nil, fmt.Errorf("failed to upsert session: %w", err)
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to upsert session", err)
	}

	if request.Config.ConfigType == nil {
		return nil, mterror.New(mterror.InvalidRequestKind, "session config must not be nil")
	}

	// This manager is responsible for the session, so we
	// need to create a local session for it.
	if storedSession.ManagerID == s.state.ManagerID {
		var workerType workers.WorkerType
		if request.Type == managerPb.CreateSessionRequest_runner {
			workerType = workers.WorkerTypeRunner
		} else {
			return nil, mterror.New(mterror.InvalidRequestKind, "unsupported session type")
		}

		connectionInput := &workers.WorkerConnectionInput{
			SessionID:    request.SessionId,
			ConnectionID: "",
			MCPClient:    client,
		}

		if request.Config.GetRunConfigWithLauncher() != nil {
			connectionInput.RunConfig, err = s.launcher.GetRunnerLaunchParams(request.Config.GetRunConfigWithLauncher())
			if err != nil {
				log.Printf("Failed to get runner launch params: %v\n", err)
				return nil, mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "failed_to_get_launch_params", err.Error(), err)
			}
		} else if request.Config.GetRunConfigWithContainerArguments() != nil {
			connectionInput.RunConfig = request.Config.GetRunConfigWithContainerArguments()
		} else {
			return nil, mterror.New(mterror.InvalidRequestKind, "session config must contain either RunConfigWithContainerArguments or RunConfigWithLauncher")
		}

		ctx, cancel := context.WithCancel(context.Background())

		session := &LocalSession{
			McpClient:  client,
			WorkerType: workerType,

			sessionManager: s,

			storedSession:   storedSession,
			connectionInput: connectionInput,

			activeConnection:          nil,
			activeConnectionCreated:   make(chan struct{}),
			lastConnectionInteraction: time.Now(),

			workerManager: s.workerManager,

			context: ctx,
			cancel:  cancel,
		}

		s.mutex.Lock()
		s.sessions[storedSession.ID] = session
		s.mutex.Unlock()

		return session, nil
	}

	manager, err := s.managers.GetManager(storedSession.ManagerID)
	if err != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to get manager for session", err)
	}

	connection, err := s.managers.GetManagerConnection(manager.ID)
	if err != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to get manager connection", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	session := &RemoteSession{
		storedSession:             storedSession,
		lastConnectionInteraction: time.Now(),

		connection: connection,

		context: ctx,
		cancel:  cancel,
	}

	s.mutex.Lock()
	s.sessions[storedSession.ID] = session
	s.mutex.Unlock()

	return session, nil
}

func (s *Sessions) DiscardSession(sessionId string) error {
	s.mutex.Lock()

	session, exists := s.sessions[sessionId]
	if !exists {
		s.mutex.Unlock()
		return fmt.Errorf("session %s not found", sessionId)
	}

	delete(s.sessions, sessionId)

	s.mutex.Unlock()

	_, err := s.state.DeleteSession(sessionId)
	if err != nil {
		return fmt.Errorf("failed to delete session %s from state: %w", sessionId, err)
	}

	err = session.stop()
	if err != nil {
		return fmt.Errorf("failed to stop session %s: %w", sessionId, err)
	}

	return nil
}

func (s *Sessions) Stop() error {
	for id, session := range s.sessions {
		log.Printf("Stopping session %s\n", id)

		err := session.stop()
		_, err2 := s.state.DeleteSession(id)
		if err != nil {
			log.Panicf("failed to stop session %s: %v\n", id, err)
		}
		if err2 != nil {
			log.Panicf("failed to delete session %s from state: %v\n", id, err2)
		}
	}

	return nil
}

func (s *Sessions) discardRoutine() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		s.mutex.Lock()
		for id, session := range s.sessions {
			if session.CanDiscard() {
				go s.DiscardSession(id)
			}
		}
		s.mutex.Unlock()
	}
}

func (s *Sessions) pingRoutine() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		for _, session := range s.sessions {
			storedSession := session.StoredSession()
			if storedSession == nil {
				continue
			}

			storedSession.LastPingAt = time.Now().UnixMilli()

			s.pingLimiter.Go(func() {
				err := s.state.UpdateSession(storedSession)
				if err != nil {
					log.Printf("Failed to update session %s ping: %v\n", storedSession.ID, err)
				}
			})
		}
	}
}
