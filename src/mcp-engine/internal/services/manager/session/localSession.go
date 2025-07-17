package session

import (
	"context"
	"fmt"
	"log"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/getsentry/sentry-go"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mtError"
	"github.com/metorial/metorial/mcp-engine/pkg/pubsub"
	"google.golang.org/grpc"
)

const (
	LocalSessionInactivityTimeout = time.Second * 60 * 5
)

// LocalSession manages a client session with MCP capabilities
type LocalSession struct {
	// Worker configuration
	WorkerType workers.WorkerType

	// MCP Client management
	mcpClient          *mcp.MCPClient
	mcpClientInitWg    *sync.WaitGroup
	mcpClientInitMutex sync.Mutex

	// MCP Server management
	mcpServer            *mcp.MCPServer
	mcpServerInitMutex   sync.Mutex
	serverDiscoveryMutex sync.Mutex

	// Database records
	dbSession   *db.Session
	db          *db.DB
	activeRunDb *db.SessionRun

	// Message tracking
	counter atomic.Int32

	// Session management
	sessionManager *Sessions
	storedSession  *state.Session
	context        context.Context
	cancel         context.CancelFunc

	// Error state
	hasError bool

	// Connection management
	activeConnection          workers.WorkerConnection
	activeConnectionCreated   chan struct{}
	lastConnectionInteraction time.Time
	lastSessionInteraction    time.Time

	// Communication channels
	internalMessages *pubsub.Broadcaster[*mcp.MCPMessage]
	connectionInput  *workers.WorkerConnectionInput
	workerManager    *workers.WorkerManager

	// Thread safety
	mutex sync.RWMutex
}

// newLocalSession creates a new LocalSession instance
func newLocalSession(
	sessions *Sessions,
	storedSession *state.Session,
	connectionInput *workers.WorkerConnectionInput,
	dbSession *db.Session,
	workerType workers.WorkerType,
	client *mcp.MCPClient,
) *LocalSession {
	ctx, cancel := context.WithCancel(context.Background())

	mcpClientInitWg := &sync.WaitGroup{}
	if client == nil {
		mcpClientInitWg.Add(1)
	}

	return &LocalSession{
		WorkerType:                workerType,
		mcpClient:                 client,
		mcpClientInitWg:           mcpClientInitWg,
		mcpClientInitMutex:        sync.Mutex{},
		sessionManager:            sessions,
		dbSession:                 dbSession,
		db:                        sessions.db,
		hasError:                  false,
		storedSession:             storedSession,
		connectionInput:           connectionInput,
		activeConnection:          nil,
		activeConnectionCreated:   make(chan struct{}),
		lastConnectionInteraction: time.Now(),
		lastSessionInteraction:    time.Now(),
		workerManager:             sessions.workerManager,
		internalMessages:          pubsub.NewBroadcaster[*mcp.MCPMessage](),
		context:                   ctx,
		cancel:                    cancel,
	}
}

func (s *LocalSession) SendMcpMessage(req *managerPb.SendMcpMessageRequest, stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse]) *mterror.MTError {
	// Process initialization messages and regular messages separately
	initMessage, mcpMessages, err := s.processMcpMessages(req.McpMessages)
	if err != nil {
		return err
	}

	// Ensure we have an active connection
	connection, run, err := s.ensureConnection()
	if err != nil {
		sentry.CaptureException(err)
		return err
	}

	if connection == nil || run == nil {
		return mterror.New(mterror.InternalErrorKind, "no active connection for session")
	}

	go s.persistMessages(mcpMessages, run)

	wg := sync.WaitGroup{}

	// Send session and run info to the client
	wg.Add(1)
	go func() {
		defer wg.Done()
		s.sendSessionAndRunInfo(stream)
	}()

	// Handle initialization message if present
	if initMessage != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			s.handleInitMessage(initMessage, req.IncludeResponses)
		}()
	}

	// Wait for responses if requested
	if req.IncludeResponses {
		requestIDs := extractRequestIds(mcpMessages, initMessage)
		if len(requestIDs) > 0 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				go s.listenForResponses(requestIDs, connection, stream)
			}()
		}
	}

	// Send non-init messages to the connection
	for _, message := range mcpMessages {
		if err := s.sendMessageToConnection(message, connection, run); err != nil {
			return err
		}
	}

	s.Touch()
	s.lastConnectionInteraction = time.Now()

	wg.Wait()

	return nil
}

func (s *LocalSession) StreamMcpMessages(req *managerPb.StreamMcpMessagesRequest, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) *mterror.MTError {
	s.Touch()

	go s.sendStreamSessionInfo(stream)

	// Normalize request filters
	onlyIds, onlyMessageTypes := normalizeStreamFilters(req)
	responsesToWaitFor := getResponsesToWaitFor(onlyIds)

	if req.ReplayAfterUuid != nil {
		go s.replayMessages(req.SessionId, *req.ReplayAfterUuid, stream)
	}

	// Set up message subscription
	var connectionSubscriptions *connectionSubscriptions
	internalMessages := s.internalMessages.Subscribe()
	defer s.internalMessages.Unsubscribe(internalMessages)

	touchTicker := time.NewTicker(time.Second * 15)
	defer touchTicker.Stop()

	defer func() {
		if connectionSubscriptions != nil {
			connectionSubscriptions.unsubscribeAll()
		}
	}()

	for {
		if onlyIds != nil && responsesToWaitFor <= 0 {
			return nil
		}

		// Check if we have an active connection
		connection := s.activeConnection
		if connection == nil {
			select {
			case <-stream.Context().Done():
				return nil
			case <-s.context.Done():
				return nil
			case <-touchTicker.C:
				s.Touch()
			case message := <-internalMessages:
				if s.canSendMessage(onlyIds, onlyMessageTypes, message) {
					responsesToWaitFor--
					s.sendMessageToStream(message, stream, false)
				}
			case <-s.activeConnectionCreated:
				s.mutex.RLock()
				connection = s.activeConnection
				s.mutex.RUnlock()
			}
		}

		if connection == nil {
			continue
		}

		// Update subscription if connection has changed
		if connectionSubscriptions == nil || connectionSubscriptions.connectionID != connection.ConnectionID() {
			if connectionSubscriptions != nil {
				connectionSubscriptions.unsubscribeAll()
			}

			connectionSubscriptions = newConnectionSubscriptions(connection)

			// Send run info for the new connection
			s.sendStreamRunInfo(stream)
		}

		select {
		case <-stream.Context().Done():
			return nil
		case <-s.context.Done():
			return nil
		case <-touchTicker.C:
			s.Touch()
		case <-connectionSubscriptions.doneChan:
			// Connection closed, continue to wait for a new one
			connectionSubscriptions.unsubscribeAll()
			connectionSubscriptions = nil
			continue
		case message := <-connectionSubscriptions.msgChan:
			if s.canSendMessage(onlyIds, onlyMessageTypes, message) {
				responsesToWaitFor--
				s.sendMessageToStream(message, stream, false)
			}
		case message := <-internalMessages:
			if s.canSendMessage(onlyIds, onlyMessageTypes, message) {
				responsesToWaitFor--
				s.sendMessageToStream(message, stream, false)
			}
		case mcpErr := <-connectionSubscriptions.errChan:
			s.sendErrorToStream(mcpErr, stream)
		case output := <-connectionSubscriptions.outChan:
			s.sendOutputToStream(output, stream)
		}
	}
}

func (s *LocalSession) GetServerInfo(req *managerPb.GetServerInfoRequest) (*mcpPb.McpParticipant, *mterror.MTError) {
	connection, _, err := s.ensureConnection()
	if err != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to ensure connection", err)
	}

	server := s.initializeMcpServer(connection)
	if server == nil {
		return nil, mterror.New(mterror.InternalErrorKind, "failed to initialize MCP server")
	}

	participant, err2 := server.ToPbParticipant()
	if err2 != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to convert server to participant", err2)
	}

	return participant, nil
}

func (s *LocalSession) DiscardSession() *mterror.MTError {
	err := s.sessionManager.DiscardSession(s.storedSession.ID)
	if err != nil {
		go s.createStructuredError("discard_session_error", "failed to discard session", map[string]string{
			"internal_error": err.Error(),
		})
		return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to discard session", err)
	}
	return nil
}

func (s *LocalSession) CanDiscard() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// Never discard a session that has an active connection
	if s.activeConnection != nil {
		return false
	}

	// If the last interaction was too long ago, we can discard it
	return time.Since(s.lastSessionInteraction) > LocalSessionInactivityTimeout
}

func (s *LocalSession) StoredSession() *state.Session {
	return s.storedSession
}

func (s *LocalSession) SessionRecord() (*db.Session, *mterror.MTError) {
	return s.dbSession, nil
}

func (s *LocalSession) Touch() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.lastSessionInteraction = time.Now()

	if s.dbSession != nil && time.Since(s.dbSession.LastPingAt) > time.Second*60 {
		s.dbSession.LastPingAt = time.Now()
		if err := s.db.SaveSession(s.dbSession); err != nil {
			sentry.CaptureException(err)
			log.Printf("Failed to update last ping time for session %s: %v", s.dbSession.ID, err)
		}
	}

	if s.activeRunDb != nil && time.Since(s.activeRunDb.LastPingAt) > time.Second*60 {
		s.activeRunDb.LastPingAt = time.Now()
		if err := s.db.SaveRun(s.activeRunDb); err != nil {
			sentry.CaptureException(err)
			log.Printf("Failed to update last ping time for connection %s: %v", s.activeRunDb.ID, err)
		}
	}
}

func (s *LocalSession) processMcpMessages(rawMessages []*mcpPb.McpMessageRaw) (*mcp.MCPMessage, []*mcp.MCPMessage, *mterror.MTError) {
	var initMessage *mcp.MCPMessage
	mcpMessages := make([]*mcp.MCPMessage, 0, len(rawMessages))

	for _, rawMessage := range rawMessages {
		message, err := mcp.FromPbRawMessage(rawMessage)
		if err != nil {
			s.createMessageParseError(rawMessage.Message, err)
			return nil, nil, mterror.NewWithCodeAndInnerError(
				mterror.InvalidRequestKind,
				"run_error",
				"failed to parse MCP message",
				err,
			)
		}

		// Check if this is an initialization message
		if *message.Method == "initialize" {
			if initMessage != nil {
				s.createMultipleInitError(rawMessage.Message)
				return nil, nil, mterror.New(
					mterror.InvalidRequestKind,
					"multiple initialize messages in request",
				)
			}

			client, err := mcp.McpClientFromInitMessage(message)
			if err != nil {
				s.createInvalidInitError(rawMessage.Message, err)
				return nil, nil, mterror.NewWithCodeAndInnerError(
					mterror.InvalidRequestKind,
					"run_error",
					"failed to parse MCP message, invalid initialize message",
					err,
				)
			}

			s.setMcpClient(client)
			initMessage = message
		} else {
			mcpMessages = append(mcpMessages, message)
		}
	}

	return initMessage, mcpMessages, nil
}

func (s *LocalSession) createMessageParseError(message string, err error) {
	go s.db.CreateError(db.NewErrorStructuredError(
		s.dbSession,
		"mcp_message_parse_error",
		"failed to parse MCP message",
		map[string]string{
			"message":        message,
			"internal_error": err.Error(),
		},
	))
}

func (s *LocalSession) createMultipleInitError(message string) {
	go s.db.CreateError(db.NewErrorStructuredError(
		s.dbSession,
		"mcp_message_parse_error",
		"multiple initialize messages in request",
		map[string]string{
			"message": message,
		},
	))
}

func (s *LocalSession) createInvalidInitError(message string, err error) {
	go s.db.CreateError(db.NewErrorStructuredError(
		s.dbSession,
		"mcp_message_parse_error",
		"failed to parse MCP message, invalid initialize message",
		map[string]string{
			"message":        message,
			"internal_error": err.Error(),
		},
	))
}

func (s *LocalSession) setMcpClient(client *mcp.MCPClient) {
	s.mcpClientInitMutex.Lock()
	defer s.mcpClientInitMutex.Unlock()

	if s.mcpClient != nil {
		return
	}

	if s.dbSession.McpClient == nil {
		if s.mcpServer != nil {
			s.dbSession.McpServer = s.mcpServer
		}

		s.dbSession.McpClient = s.mcpClient
		go s.db.SaveSession(s.dbSession)
	}

	s.mcpClient = client
	s.mcpClientInitWg.Done()
}

func (s *LocalSession) persistMessages(messages []*mcp.MCPMessage, run *db.SessionRun) {
	for _, message := range messages {
		s.db.CreateMessage(
			db.NewMessage(
				s.dbSession,
				run,
				int(s.counter.Add(1)),
				db.SessionMessageSenderClient,
				message,
			),
		)
	}
}

func (s *LocalSession) sendSessionAndRunInfo(stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse]) {
	pbSes, err := s.dbSession.ToPb()
	if err == nil {
		stream.Send(&managerPb.SendMcpMessageResponse{
			Response: &managerPb.SendMcpMessageResponse_SessionEvent{
				SessionEvent: &managerPb.SessionEvent{
					Event: &managerPb.SessionEvent_InfoSession{
						InfoSession: &managerPb.SessionEventInfoSession{
							Session: pbSes,
						},
					},
				},
			},
		})
	}

	s.mutex.RLock()
	run := s.activeRunDb
	s.mutex.RUnlock()

	if run != nil {
		pbRun, err := run.ToPb()
		if err == nil {
			stream.Send(&managerPb.SendMcpMessageResponse{
				Response: &managerPb.SendMcpMessageResponse_SessionEvent{
					SessionEvent: &managerPb.SessionEvent{
						Event: &managerPb.SessionEvent_InfoRun{
							InfoRun: &managerPb.SessionEventInfoRun{
								Run: pbRun,
							},
						},
					},
				},
			})
		}
	}
}

func (s *LocalSession) handleInitMessage(
	initMessage *mcp.MCPMessage,
	includeResponses bool,
) {
	var err error
	var message *mcp.MCPMessage

	// If we have already discovered the server, we don't even need to send the init message
	if s.dbSession.Server != nil && s.dbSession.Server.McpServer != nil {
		message, err = s.dbSession.Server.McpServer.ToInitMessage(s.mcpClient, initMessage)
	} else {
		connection, _, err2 := s.ensureConnection()
		if err2 != nil {
			sentry.CaptureException(err2)
			return
		}

		if connection == nil {
			return
		}

		server, err := connection.GetServer()
		if err != nil {
			sentry.CaptureException(err)
			s.createStructuredError("run_error", "failed to get server info", map[string]string{
				"internal_error": err.Error(),
			})
			return
		}

		message, err = server.ToInitMessage(s.mcpClient, initMessage)
		if err != nil {
			sentry.CaptureException(err)
			return
		}
	}

	if err != nil {
		return
	}

	s.internalMessages.Publish(message)
}

func extractRequestIds(messages []*mcp.MCPMessage, initMessage *mcp.MCPMessage) []string {
	requestIds := make([]string, 0)

	for _, message := range messages {
		if message.MsgType == mcp.RequestType {
			id := message.GetStringId()
			if id != "" && !slices.Contains(requestIds, id) {
				requestIds = append(requestIds, id)
			}
		}
	}

	if initMessage != nil && initMessage.MsgType == mcp.RequestType {
		id := initMessage.GetStringId()
		if id != "" && !slices.Contains(requestIds, id) {
			requestIds = append(requestIds, id)
		}
	}

	return requestIds
}

func (s *LocalSession) listenForResponses(
	requestIds []string,
	connection workers.WorkerConnection,
	stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse],
) {
	timeout := time.NewTimer(time.Second * 60)
	defer timeout.Stop()

	refreshTicker := time.NewTicker(time.Second * 15)
	defer refreshTicker.Stop()

	responsesToWaitFor := len(requestIds)

	// Subscribe to message channels
	msgChan := connection.Messages().Subscribe()
	defer connection.Messages().Unsubscribe(msgChan)

	errChan := connection.Errors().Subscribe()
	defer connection.Errors().Unsubscribe(errChan)

	doneChan := connection.Done().Subscribe()
	defer connection.Done().Unsubscribe(doneChan)

	internalMessages := s.internalMessages.Subscribe()
	defer s.internalMessages.Unsubscribe(internalMessages)

	for {
		if responsesToWaitFor <= 0 {
			return
		}

		s.Touch()
		s.lastConnectionInteraction = time.Now()

		select {
		case <-stream.Context().Done():
			return
		case <-s.context.Done():
			return
		case <-refreshTicker.C:
			// Touch the session to keep it alive
		case <-doneChan:
			s.sendTimeoutError(stream, responsesToWaitFor)
			return
		case <-timeout.C:
			s.sendTimeoutError(stream, responsesToWaitFor)
			return
		case message := <-msgChan:
			if slices.Contains(requestIds, message.GetStringId()) {
				s.sendMessageResponse(stream, message)
				responsesToWaitFor--
			}
		case message := <-internalMessages:
			if slices.Contains(requestIds, message.GetStringId()) {
				s.sendMessageResponse(stream, message)
				responsesToWaitFor--
			}
		case mcpErr := <-errChan:
			s.sendErrorResponse(stream, mcpErr)
			return
		}
	}
}

func (s *LocalSession) sendTimeoutError(
	stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse],
	responsesToWaitFor int,
) {
	if responsesToWaitFor <= 0 {
		return
	}

	response := &managerPb.SendMcpMessageResponse{
		Response: &managerPb.SendMcpMessageResponse_McpError{
			McpError: &mcpPb.McpError{
				ErrorCode:    mcpPb.McpError_timeout,
				ErrorMessage: fmt.Sprintf("timeout waiting for %d MCP responses", responsesToWaitFor),
			},
		},
	}

	if err := stream.Send(response); err != nil {
		log.Printf("Failed to send timeout error: %v", err)
	}
}

func (s *LocalSession) sendMessageResponse(
	stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse],
	message *mcp.MCPMessage,
) {
	response := &managerPb.SendMcpMessageResponse{
		Response: &managerPb.SendMcpMessageResponse_McpMessage{
			McpMessage: message.ToPbMessage(),
		},
	}

	if err := stream.Send(response); err != nil {
		log.Printf("Failed to send response message: %v", err)
	}
}

func (s *LocalSession) sendErrorResponse(
	stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse],
	mcpErr *mcpPb.McpError,
) {
	response := &managerPb.SendMcpMessageResponse{
		Response: &managerPb.SendMcpMessageResponse_McpError{
			McpError: mcpErr,
		},
	}

	if err := stream.Send(response); err != nil {
		log.Printf("Failed to send error message: %v", err)
	}
}

func (s *LocalSession) sendMessageToConnection(message *mcp.MCPMessage, connection workers.WorkerConnection, run *db.SessionRun) *mterror.MTError {
	err := connection.AcceptMessage(message)
	if err != nil {
		sentry.CaptureException(err)
		s.createStructuredErrorWithRun("mcp_message_processing_failed", "failed to process MCP message", map[string]string{
			"message":        string(message.GetRawPayload()),
			"internal_error": err.Error(),
		})

		return mterror.NewWithCodeAndInnerError(
			mterror.InternalErrorKind,
			"mcp_message_processing_failed",
			"failed to process MCP message",
			err,
		)
	}
	return nil
}

func (s *LocalSession) ensureConnection() (workers.WorkerConnection, *db.SessionRun, *mterror.MTError) {
	// Wait until the MCP client is initialized
	s.mcpClientInitWg.Wait()

	s.mutex.RLock()
	if s.activeConnection != nil {
		connection := s.activeConnection
		run := s.activeRunDb
		s.mutex.RUnlock()

		s.Touch()
		s.lastConnectionInteraction = time.Now()
		return connection, run, nil
	}
	s.mutex.RUnlock()

	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Double-check if the connection was created while waiting for the lock
	if s.activeConnection != nil {
		return s.activeConnection, s.activeRunDb, nil
	}

	// Create a new connection
	connection, run, err := s.createNewConnection()
	if err != nil {
		return nil, nil, err
	}

	// Initialize server discovery if needed
	if !s.dbSession.Server.LastDiscoveryAt.Valid || time.Since(s.dbSession.Server.LastDiscoveryAt.Time) > time.Hour*24 {
		go s.discoverServer(connection)
	}

	// Notify that a new connection has been created
	select {
	case s.activeConnectionCreated <- struct{}{}:
	default:
		// Channel is full or closed, ignore
	}

	return connection, run, nil
}

func (s *LocalSession) createNewConnection() (workers.WorkerConnection, *db.SessionRun, *mterror.MTError) {
	connection, worker, err := createConnection(s.workerManager, s.connectionInput, s.mcpClient, s.WorkerType)
	if err != nil {
		s.createStructuredError("run_error", "failed to create connection", map[string]string{
			"internal_error": err.Error(),
		})
		return nil, nil, err
	}

	var connectionType db.SessionRunType
	switch s.WorkerType {
	case workers.WorkerTypeContainer:
		connectionType = db.SessionRunTypeContainer
	case workers.WorkerTypeRemote:
		connectionType = db.SessionRunTypeRemote
	default:
		return nil, nil, mterror.New(mterror.InternalErrorKind, "unsupported worker type for local session")
	}

	run, err2 := s.db.CreateRun(
		db.NewRun(
			connection.ConnectionID(),
			worker.WorkerID(),
			s.dbSession,
			connectionType,
			db.SessionRunStatusActive,
		),
	)
	if err2 != nil {
		return nil, nil, mterror.NewWithInnerError(
			mterror.InternalErrorKind,
			"failed to create connection in database",
			err2,
		)
	}

	s.activeRunDb = run
	log.Printf("Created connection %s for session %s with worker %s",
		connection.ConnectionID(), s.storedSession.ID, worker.WorkerID())

	go s.monitorConnection(run, connection)

	if err := connection.Start(true); err != nil {
		s.createStructuredErrorWithRun("run_error", "failed to start/connect to server", map[string]string{
			"internal_error": err.Error(),
		})
		return nil, nil, mterror.NewWithCodeAndInnerError(
			mterror.InternalErrorKind,
			"run_error",
			"failed to start server",
			err,
		)
	}

	log.Printf("Started connection %s for session %s with worker %s",
		connection.ConnectionID(), s.storedSession.ID, worker.WorkerID())

	s.activeConnection = connection
	s.lastConnectionInteraction = time.Now()
	s.lastSessionInteraction = time.Now()

	// Initialize the MCP server asynchronously
	go s.initializeMcpServer(connection)

	return connection, run, nil
}

func (s *LocalSession) initializeMcpServer(connection workers.WorkerConnection) *mcp.MCPServer {
	if s.dbSession.McpServer == nil {
		server, err := connection.GetServer()
		if err == nil {
			s.dbSession.McpServer = server
			s.dbSession.McpClient = s.mcpClient
			s.db.SaveSession(s.dbSession)
		}
	}

	s.mcpServerInitMutex.Lock()
	defer s.mcpServerInitMutex.Unlock()

	if s.mcpServer != nil {
		return s.mcpServer
	}

	server, err := connection.GetServer()
	if err != nil {
		return nil
	}

	s.mcpServer = server
	return s.mcpServer
}

func (s *LocalSession) stop(type_ SessionStopType) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.activeConnectionCreated != nil {
		close(s.activeConnectionCreated)
		s.activeConnectionCreated = nil
	}

	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}

	var dbErr error

	// Update session status in database
	if s.dbSession.Status == db.SessionStatusActive {
		s.dbSession.EndedAt = db.NullTimeNow()

		switch type_ {
		case SessionStopTypeClose:
			s.dbSession.Status = db.SessionStatusClosed
		case SessionStopTypeExpire:
			s.dbSession.Status = db.SessionStatusExpired
		case SessionStopTypeError:
			s.dbSession.Status = db.SessionStatusError
		}

		dbErr = s.db.SaveSession(s.dbSession)
	}

	// Close active connection if any
	if s.activeConnection != nil {
		err := s.activeConnection.Close()

		if s.activeRunDb != nil && s.activeRunDb.Status == db.SessionRunStatusActive {
			s.activeRunDb.EndedAt = db.NullTimeNow()
			switch type_ {
			case SessionStopTypeClose:
				s.activeRunDb.Status = db.SessionRunStatusClosed
			case SessionStopTypeExpire:
				s.activeRunDb.Status = db.SessionRunStatusExpired
			case SessionStopTypeError:
				s.activeRunDb.Status = db.SessionRunStatusError
			}

			dbErr = s.db.SaveRun(s.activeRunDb)
		}

		s.activeConnection = nil
		if err != nil {
			sentry.CaptureException(err)
			return fmt.Errorf("failed to close active connection: %w", err)
		}
	}

	if dbErr != nil {
		return fmt.Errorf("failed to save session in database: %w", dbErr)
	}

	return nil
}

// monitorConnection monitors the connection for messages, errors, and timeouts
func (s *LocalSession) monitorConnection(run *db.SessionRun, connection workers.WorkerConnection) {
	timeout := connection.InactivityTimeout()

	ticker := time.NewTicker(time.Second * 5)
	defer ticker.Stop()

	subs := newConnectionSubscriptions(connection)
	defer subs.unsubscribeAll()

loop:
	for {
		select {
		case <-ticker.C:
			if time.Since(s.lastConnectionInteraction) > timeout {
				s.closeConnectionDueToInactivity(connection, run)
				break loop
			} else if s.activeConnection != nil && s.activeConnection.ConnectionID() != connection.ConnectionID() {
				s.cleanupOldConnection(connection, run)
				break loop
			}

		case <-subs.doneChan:
			s.handleConnectionClosed(connection, run)
			break loop

		case err := <-subs.errChan:
			s.hasError = true
			go s.db.CreateError(db.NewErrorFromMcp(
				s.dbSession,
				run,
				err,
			))

		case message := <-subs.msgChan:
			if !strings.HasPrefix(message.GetStringId(), "mte/") {
				go s.db.CreateMessage(
					db.NewMessage(
						s.dbSession,
						run,
						int(s.counter.Add(1)),
						db.SessionMessageSenderServer,
						message,
					),
				)
			}

		case output := <-subs.outChan:
			go s.db.CreateEvent(
				db.NewOutputEvent(
					s.dbSession,
					run,
					output,
				),
			)
		}
	}

	log.Printf("Connection %s for session %s has been closed", connection.ConnectionID(), s.storedSession.ID)
}

func (s *LocalSession) closeConnectionDueToInactivity(connection workers.WorkerConnection, run *db.SessionRun) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.activeConnection != nil && s.activeConnection.ConnectionID() == connection.ConnectionID() {
		s.activeConnection = nil

		if run.Status == db.SessionRunStatusActive {
			run.EndedAt = db.NullTimeNow()
			run.Status = db.SessionRunStatusExpired
			s.db.SaveRun(run)
		}

		go connection.Close()

		log.Printf("Connection %s for session %s has been closed due to inactivity",
			connection.ConnectionID(), s.storedSession.ID)
	}
}

func (s *LocalSession) cleanupOldConnection(connection workers.WorkerConnection, run *db.SessionRun) {
	err := connection.Close()
	if err != nil {
		sentry.CaptureException(err)
		log.Printf("Failed to close old connection %s: %v", connection.ConnectionID(), err)
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	if run.Status == db.SessionRunStatusActive {
		run.EndedAt = db.NullTimeNow()
		run.Status = db.SessionRunStatusExpired
		s.db.SaveRun(run)
	}
}

func (s *LocalSession) handleConnectionClosed(connection workers.WorkerConnection, run *db.SessionRun) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.activeConnection != nil && s.activeConnection.ConnectionID() == connection.ConnectionID() {
		s.activeConnection = nil

		if run.Status == db.SessionRunStatusActive {
			run.EndedAt = db.NullTimeNow()

			if s.hasError {
				run.Status = db.SessionRunStatusError
			} else {
				run.Status = db.SessionRunStatusClosed
			}

			s.db.SaveRun(run)
		}
	}
}

func (s *LocalSession) discoverServer(connection workers.WorkerConnection) {
	s.serverDiscoveryMutex.Lock()
	defer s.serverDiscoveryMutex.Unlock()

	discoverServerWithEphemeralConnection(s.db, s.dbSession.Server, connection)
}

func (s *LocalSession) createStructuredError(errorType, message string, data map[string]string) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	s.db.CreateError(db.NewErrorStructuredErrorWithRun(
		s.dbSession,
		s.activeRunDb,
		errorType,
		message,
		data,
	))
}

func (s *LocalSession) createStructuredErrorWithRun(errorType, message string, data map[string]string) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	s.db.CreateError(db.NewErrorStructuredErrorWithRun(
		s.dbSession,
		s.activeRunDb,
		errorType,
		message,
		data,
	))
}

func (s *LocalSession) sendStreamSessionInfo(stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) {
	pbSes, err := s.dbSession.ToPb()
	if err == nil {
		stream.Send(&managerPb.StreamMcpMessagesResponse{
			Response: &managerPb.StreamMcpMessagesResponse_SessionEvent{
				SessionEvent: &managerPb.SessionEvent{
					Event: &managerPb.SessionEvent_InfoSession{
						InfoSession: &managerPb.SessionEventInfoSession{
							Session: pbSes,
						},
					},
				},
			},
		})
	}
}

func (s *LocalSession) sendStreamRunInfo(stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) {
	s.mutex.RLock()
	dbRun := s.activeRunDb
	s.mutex.RUnlock()

	if dbRun != nil {
		pbRun, err := dbRun.ToPb()
		if err == nil {
			stream.Send(&managerPb.StreamMcpMessagesResponse{
				Response: &managerPb.StreamMcpMessagesResponse_SessionEvent{
					SessionEvent: &managerPb.SessionEvent{
						Event: &managerPb.SessionEvent_InfoRun{
							InfoRun: &managerPb.SessionEventInfoRun{
								Run: pbRun,
							},
						},
					},
				},
			})
		}

		pbSes, err := s.dbSession.ToPb()
		if err == nil {
			stream.Send(&managerPb.StreamMcpMessagesResponse{
				Response: &managerPb.StreamMcpMessagesResponse_SessionEvent{
					SessionEvent: &managerPb.SessionEvent{
						Event: &managerPb.SessionEvent_InfoSession{
							InfoSession: &managerPb.SessionEventInfoSession{
								Session: pbSes,
							},
						},
					},
				},
			})
		}
	}
}

func normalizeStreamFilters(req *managerPb.StreamMcpMessagesRequest) ([]string, []mcpPb.McpMessageType) {
	onlyIds := req.OnlyIds
	if onlyIds != nil && len(onlyIds) == 0 {
		onlyIds = nil // If no IDs are requested, we don't need to filter
	}

	onlyMessageTypes := req.OnlyMessageTypes
	if onlyMessageTypes != nil && len(onlyMessageTypes) == 0 {
		onlyMessageTypes = nil // If no message types are requested, we don't need to filter
	}

	return onlyIds, onlyMessageTypes
}

func getResponsesToWaitFor(onlyIds []string) int {
	if onlyIds == nil {
		return 0
	}
	return len(onlyIds)
}

func (s *LocalSession) replayMessages(sessionId string, afterUuid string, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) {
	messages, err := s.db.ListGlobalSessionMessagesAfter(sessionId, afterUuid)
	if err != nil {
		sentry.CaptureException(err)
		log.Printf("Failed to list messages after UUID %s: %v", afterUuid, err)
		return
	}

	for _, message := range messages {
		pbMessage, err := message.ToPbMessage()
		if err != nil {
			log.Printf("Failed to convert message to PB message: %v", err)
			continue
		}

		response := &managerPb.StreamMcpMessagesResponse{
			Response: &managerPb.StreamMcpMessagesResponse_McpMessage{
				McpMessage: pbMessage,
			},
			IsReplay: true,
		}

		if err = stream.Send(response); err != nil {
			log.Printf("Failed to send replayed message: %v", err)
			return
		}
	}
}

func (s *LocalSession) canSendMessage(onlyIds []string, onlyMessageTypes []mcpPb.McpMessageType, message *mcp.MCPMessage) bool {
	if onlyIds != nil && !slices.Contains(onlyIds, message.GetStringId()) {
		return false
	}

	if onlyMessageTypes != nil && !slices.Contains(onlyMessageTypes, message.GetPbMessageType()) {
		return false
	}

	return true
}

func (s *LocalSession) sendMessageToStream(message *mcp.MCPMessage, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse], isReplay bool) {
	response := &managerPb.StreamMcpMessagesResponse{
		Response: &managerPb.StreamMcpMessagesResponse_McpMessage{
			McpMessage: message.ToPbMessage(),
		},
		IsReplay: isReplay,
	}

	if err := stream.Send(response); err != nil {
		log.Printf("Failed to send message to stream: %v", err)
	}
}

func (s *LocalSession) sendErrorToStream(mcpErr *mcpPb.McpError, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) {
	response := &managerPb.StreamMcpMessagesResponse{
		Response: &managerPb.StreamMcpMessagesResponse_McpError{
			McpError: mcpErr,
		},
	}

	if err := stream.Send(response); err != nil {
		log.Printf("Failed to send error to stream: %v", err)
	}
}

func (s *LocalSession) sendOutputToStream(output *mcpPb.McpOutput, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) {
	response := &managerPb.StreamMcpMessagesResponse{
		Response: &managerPb.StreamMcpMessagesResponse_McpOutput{
			McpOutput: output,
		},
	}

	if err := stream.Send(response); err != nil {
		log.Printf("Failed to send output to stream: %v", err)
	}
}

type connectionSubscriptions struct {
	connectionID string
	msgChan      chan *mcp.MCPMessage
	errChan      chan *mcpPb.McpError
	outChan      chan *mcpPb.McpOutput
	doneChan     chan struct{}
	connection   workers.WorkerConnection
}

func newConnectionSubscriptions(connection workers.WorkerConnection) *connectionSubscriptions {
	return &connectionSubscriptions{
		connectionID: connection.ConnectionID(),
		msgChan:      connection.Messages().Subscribe(),
		errChan:      connection.Errors().Subscribe(),
		outChan:      connection.Output().Subscribe(),
		doneChan:     connection.Done().Subscribe(),
		connection:   connection,
	}
}

func (c *connectionSubscriptions) unsubscribeAll() {
	if c.msgChan != nil {
		c.connection.Messages().Unsubscribe(c.msgChan)
		c.msgChan = nil
	}

	if c.errChan != nil {
		c.connection.Errors().Unsubscribe(c.errChan)
		c.errChan = nil
	}

	if c.outChan != nil {
		c.connection.Output().Unsubscribe(c.outChan)
		c.outChan = nil
	}

	if c.doneChan != nil {
		c.connection.Done().Unsubscribe(c.doneChan)
		c.doneChan = nil
	}
}
