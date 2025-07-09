package session

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/launcher"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/limiter"
	"github.com/metorial/metorial/mcp-engine/pkg/lock"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mt-error"
	"github.com/metorial/metorial/mcp-engine/pkg/util"
	"google.golang.org/grpc"
)

type SessionStopType int

const (
	SessionStopTypeClose SessionStopType = iota
	SessionStopTypeExpire
	SessionStopTypeError
)

type Session interface {
	SendMcpMessage(req *managerPb.SendMcpMessageRequest, stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse]) *mterror.MTError
	StreamMcpMessages(req *managerPb.StreamMcpMessagesRequest, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) *mterror.MTError
	GetServerInfo(req *managerPb.GetServerInfoRequest) (*mcpPb.McpParticipant, *mterror.MTError)
	StoredSession() *state.Session
	DiscardSession() *mterror.MTError

	SessionRecord() (*db.Session, *mterror.MTError)

	CanDiscard() bool
	stop(SessionStopType) error
}

type Sessions struct {
	sessions map[string]Session

	db *db.DB

	state         *state.StateManager
	workerManager *workers.WorkerManager
	managers      *OtherManagers

	keylock     *lock.KeyLock
	pingLimiter *limiter.Limiter
	mutex       sync.RWMutex

	launcher *launcher.Launcher
}

func NewSessions(
	db *db.DB,
	state *state.StateManager,
	workerManager *workers.WorkerManager,
) *Sessions {
	sessions := &Sessions{
		sessions:      make(map[string]Session),
		state:         state,
		db:            db,
		workerManager: workerManager,
		managers:      NewOtherManagers(state),
		keylock:       lock.NewKeyLock(),
		pingLimiter:   limiter.NewLimiter(100), // Max 100 ping updates at a time
		launcher:      launcher.NewLauncher(workerManager),
	}

	go sessions.discardRoutine()
	go sessions.pingRoutine()
	go sessions.printStateRoutine()

	return sessions
}

func (s *Sessions) GetLocalSession(sessionId string) Session {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return s.sessions[sessionId]
}

func (s *Sessions) GetSessionUnsafe(sessionId string) (Session, *mterror.MTError) {
	if sessionId == "" {
		return nil, mterror.New(mterror.InvalidRequestKind, "session ID cannot be empty")
	}

	s.keylock.Lock(sessionId)
	defer s.keylock.Unlock(sessionId)

	s.mutex.RLock()
	localSession, exists := s.sessions[sessionId]
	s.mutex.RUnlock()
	if exists {
		return localSession, nil
	}

	storedSession, err := s.state.GetSession(sessionId)
	if err != nil {
		if err.Error() == "session not found" {
			return nil, mterror.NewWithDetails(mterror.NotFoundKind, "session not found", map[string]string{
				"session_id": sessionId,
			})
		}

		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to get session from state", err)
	}

	return s.EnsureRemoteSession(storedSession)
}

func (s *Sessions) UpsertSession(
	request *managerPb.CreateSessionRequest,
) (Session, *mterror.MTError) {
	existing := s.GetLocalSession(request.SessionId)
	if existing != nil {
		return existing, nil
	}

	s.keylock.Lock(request.SessionId)
	defer s.keylock.Unlock(request.SessionId)

	client, err := mcp.ParseMcpClient([]byte(request.McpClient.ParticipantJson))
	if err != nil {
		return nil, mterror.NewWithInnerError(mterror.InvalidRequestKind, "failed to parse MCP client", err)
	}

	prospectiveSessionUuid := util.Must(uuid.NewV7()).String()

	storedSession, err := s.state.UpsertSession(
		request.SessionId,
		s.state.ManagerID,
		prospectiveSessionUuid,
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
		var dbType db.SessionType
		switch request.Config.ConfigType.(type) {
		case *managerPb.SessionConfig_ContainerRunConfigWithLauncher, *managerPb.SessionConfig_ContainerRunConfigWithContainerArguments:
			workerType = workers.WorkerTypeContainer
			dbType = db.SessionTypeContainer

		case *managerPb.SessionConfig_RemoteRunConfigWithLauncher, *managerPb.SessionConfig_RemoteRunConfigWithServer:
			workerType = workers.WorkerTypeRemote
			dbType = db.SessionTypeRemote
		}

		connectionInput := &workers.WorkerConnectionInput{
			SessionID:    request.SessionId,
			ConnectionID: "",
			MCPClient:    client,
		}

		dbSession, err := s.db.CreateSession(db.NewSession(
			prospectiveSessionUuid,
			request.SessionId,
			db.SessionStatusActive,
			dbType,
			client,
			request.Metadata,
		))
		if err != nil {
			log.Printf("Failed to create session in DB: %v\n", err)
			return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to create session in DB", err)
		}

		if request.Config.GetContainerRunConfigWithLauncher() != nil {
			connectionInput.ContainerRunConfig, err = s.launcher.GetContainerLaunchParams(request.Config.GetContainerRunConfigWithLauncher())
			if err != nil {
				go s.db.CreateError(db.NewErrorStructuredError(
					dbSession,
					"get_launch_params_error",
					err.Error(),
					map[string]string{},
				))

				log.Printf("Failed to get runner launch params: %v\n", err)
				return nil, mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "failed_to_get_launch_params", err.Error(), err)
			}
		} else if request.Config.GetContainerRunConfigWithContainerArguments() != nil {
			connectionInput.ContainerRunConfig = request.Config.GetContainerRunConfigWithContainerArguments()
		} else if request.Config.GetRemoteRunConfigWithLauncher() != nil {
			connectionInput.RemoteRunConfig, err = s.launcher.GetRemoteLaunchParams(request.Config.GetRemoteRunConfigWithLauncher())
			if err != nil {
				go s.db.CreateError(db.NewErrorStructuredError(
					dbSession,
					"get_launch_params_error",
					err.Error(),
					map[string]string{},
				))

				log.Printf("Failed to get remote launch params: %v\n", err)
				return nil, mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "failed_to_get_launch_params", err.Error(), err)
			}
		} else if request.Config.GetRemoteRunConfigWithServer() != nil {
			connectionInput.RemoteRunConfig = request.Config.GetRemoteRunConfigWithServer()
		} else {
			return nil, mterror.New(mterror.InvalidRequestKind, "session config must contain either RunConfigWithContainerArguments or RunConfigWithLauncher")
		}

		ctx, cancel := context.WithCancel(context.Background())

		session := &LocalSession{
			McpClient:  client,
			WorkerType: workerType,

			sessionManager: s,
			dbSession:      dbSession,
			db:             s.db,

			hasError: false,

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

	ses, err2 := s.EnsureRemoteSession(storedSession)
	return ses, err2
}

func (s *Sessions) EnsureRemoteSession(storedSession *state.Session) (*RemoteSession, *mterror.MTError) {
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
		sessionManager: s,

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

	err = session.stop(SessionStopTypeClose)
	if err != nil {
		return fmt.Errorf("failed to stop session %s: %w", sessionId, err)
	}

	return nil
}

func (s *Sessions) Stop() error {
	for id, session := range s.sessions {
		log.Printf("Stopping session %s\n", id)

		err := session.stop(SessionStopTypeExpire)
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

func printState(s *Sessions) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	log.Println("== Sessions State ==")

	log.Println("Total Sessions:", len(s.sessions))

	for id, session := range s.sessions {
		log.Printf("Session ID: %s, Type: %T\n", id, session)
	}
}

func (s *Sessions) printStateRoutine() {
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			printState(s)
		}
	}()
}
