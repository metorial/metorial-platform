package session

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/google/uuid"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/launcher"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mtError"
	"github.com/metorial/metorial/modules/limiter"
	"github.com/metorial/metorial/modules/lock"
	"github.com/metorial/metorial/modules/util"
	"google.golang.org/grpc"
)

type SessionStopType int

const (
	SessionStopTypeClose SessionStopType = iota
	SessionStopTypeExpire
	SessionStopTypeError
)

type Session interface {
	SendMcpMessage(req *managerPb.SendMcpMessageRequest, stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse]) *mterror.MTError
	StreamMcpMessages(req *managerPb.StreamMcpMessagesRequest, stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse]) *mterror.MTError
	GetServerInfo(req *managerPb.GetServerInfoRequest) (*mcpPb.McpParticipant, *mterror.MTError)
	StoredSession() *state.Session
	DiscardSession() *mterror.MTError
	Touch()

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

func (s *Sessions) GetSessionSafe(sessionId string) (Session, *mterror.MTError) {
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
			return nil, nil
		}

		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to get session from state", err)
	}

	return s.EnsureRemoteSession(storedSession)
}

func (s *Sessions) GetSessionUnsafe(sessionId string) (Session, *mterror.MTError) {
	nulSes, err := s.GetSessionSafe(sessionId)
	if err != nil {
		return nil, err
	}

	if nulSes == nil {
		// If the session is not found, we return an error
		return nil, mterror.NewWithDetails(mterror.NotFoundKind, "session not found", map[string]string{
			"session_id": sessionId,
		})
	}

	return nulSes, nil
}

func (s *Sessions) UpsertSession(
	request *managerPb.CreateSessionRequest,
) (Session, *mterror.MTError) {
	if request.Config == nil {
		return nil, mterror.New(mterror.InvalidRequestKind, "Config must be provided in session config")
	}

	if request.Config.McpConfig == nil || request.Config.McpConfig.McpVersion == "" {
		return nil, mterror.New(mterror.InvalidRequestKind, "McpConfig must be provided in session config")
	}

	existing := s.GetLocalSession(request.SessionId)
	if existing != nil {
		return existing, nil
	}

	s.keylock.Lock(request.SessionId)
	defer s.keylock.Unlock(request.SessionId)

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

	if request.Config.ServerConfig.ConfigType == nil {
		return nil, mterror.New(mterror.InvalidRequestKind, "session config must not be nil")
	}

	// This manager is responsible for the session, so we
	// need to create a local session for it.
	if storedSession.ManagerID == s.state.ManagerID {
		return s.EnsureLocalSession(
			storedSession,
			request,
			prospectiveSessionUuid,
			false, // Not a takeover
		)
	}

	return s.EnsureRemoteSessionOrTakeOver(
		storedSession,
		request,
		prospectiveSessionUuid,
	)
}

func (s *Sessions) tryToGetManagerForRemoteSession(storedSession *state.Session) (managerPb.McpManagerClient, *mterror.MTError) {
	manager, err := s.managers.GetManager(storedSession.ManagerID)
	if err != nil {
		sentry.CaptureException(err)
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to get manager for session", err)
	}

	connection, err := s.managers.GetManagerConnection(manager.ID)
	if err != nil {
		sentry.CaptureException(err)
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to get manager connection", err)
	}

	return connection, nil
}

func (s *Sessions) EnsureRemoteSession(storedSession *state.Session) (*RemoteSession, *mterror.MTError) {
	connection, err := s.tryToGetManagerForRemoteSession(storedSession)
	if err != nil {
		return nil, err
	}

	session := newRemoteSession(
		s,
		storedSession,
		connection,
	)

	s.mutex.Lock()
	s.sessions[storedSession.ID] = session
	s.mutex.Unlock()

	return session, nil
}

func (s *Sessions) EnsureRemoteSessionOrTakeOver(
	storedSession *state.Session,
	request *managerPb.CreateSessionRequest,
	prospectiveSessionUuid string,
) (Session, *mterror.MTError) {
	connection, err := s.tryToGetManagerForRemoteSession(storedSession)
	if err != nil {
		return s.EnsureLocalSession(
			storedSession,
			request,
			prospectiveSessionUuid,
			true,
		)
	}

	session := newRemoteSession(
		s,
		storedSession,
		connection,
	)

	s.mutex.Lock()
	s.sessions[storedSession.ID] = session
	s.mutex.Unlock()

	return session, nil
}

func (s *Sessions) EnsureLocalSession(
	storedSession *state.Session,
	request *managerPb.CreateSessionRequest,
	prospectiveSessionUuid string,
	isTakeover bool,
) (Session, *mterror.MTError) {
	var client *mcp.MCPClient
	if request.McpClient != nil {
		var err error
		client, err = mcp.ParseMcpClient([]byte(request.McpClient.ParticipantJson))
		if err != nil {
			return nil, mterror.NewWithInnerError(mterror.InvalidRequestKind, "failed to parse MCP client", err)
		}
	}

	if isTakeover {
		prospectiveSessionUuid = util.Must(uuid.NewV7()).String()

		storedSession.ManagerID = s.state.ManagerID
		storedSession.SessionUuid = prospectiveSessionUuid
		storedSession.CreatedAt = time.Now().UnixMilli()

		err := s.state.UpdateSession(storedSession)
		if err != nil {
			sentry.CaptureException(err)
			log.Printf("Failed to update session %s during takeover: %v\n", storedSession.ID, err)
			return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to update session during takeover", err)
		}
	}

	server, connectionInput, err2 := processServerConfig(
		storedSession.ID,
		client,
		request.Config.ServerConfig,
		request.Config.McpConfig,
		s.db,
	)
	if err2 != nil {
		return nil, err2
	}

	dbSession, err := s.db.CreateSession(db.NewSession(
		prospectiveSessionUuid,
		request.SessionId,
		server,
		db.SessionStatusActive,
		workerTypeToDbType(connectionInput.WorkerType),
		client,
		request.Config.McpConfig.McpVersion,
		request.Metadata,
	))
	if err != nil {
		sentry.CaptureException(err)
		log.Printf("Failed to create session in DB: %v\n", err)
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to create session in DB", err)
	}

	err2 = runLauncherForServerConfigIfNeeded(s.launcher, connectionInput, request.Config.ServerConfig)
	if err2 != nil {
		sentry.CaptureException(err2)
		go s.db.CreateEvent(db.NewLauncherEvent(
			dbSession,
			db.SessionEventTypeLauncherRun_Error,
		))

		go s.db.CreateError(db.NewErrorStructuredError(
			dbSession,
			"get_launch_params_error",
			err2.Error(),
			map[string]string{},
		))

		log.Printf("Failed to get runner launch params: %v\n", err2)
		return nil, mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "failed_to_get_launch_params", err2.Error(), err2)
	}

	go s.db.CreateEvent(db.NewLauncherEvent(
		dbSession,
		db.SessionEventTypeLauncherRun_Success,
	))

	session := newLocalSession(
		s,
		storedSession,
		connectionInput,
		dbSession,
		connectionInput.WorkerType,
		client,
	)

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
	sessionIds := make([]string, 0, len(s.sessions))
	s.mutex.RLock()
	for id := range s.sessions {
		sessionIds = append(sessionIds, id)
	}
	s.mutex.RUnlock()

	for _, id := range sessionIds {
		log.Printf("Stopping session %s\n", id)

		session := s.GetLocalSession(id)

		err := session.stop(SessionStopTypeExpire)
		_, err2 := s.state.DeleteSession(id)
		if err != nil {
			sentry.CaptureException(err)
			log.Panicf("failed to stop session %s: %v\n", id, err)
		}
		if err2 != nil {
			sentry.CaptureException(err2)
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
		currentSessions := make([]Session, 0)
		s.mutex.RLock()
		for _, session := range s.sessions {
			currentSessions = append(currentSessions, session)
		}
		s.mutex.RUnlock()

		for _, session := range currentSessions {
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
	s.mutex.RLock()
	defer s.mutex.RUnlock()

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
