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

	"github.com/google/uuid"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mt-error"
	"github.com/metorial/metorial/mcp-engine/pkg/pubsub"
	"github.com/metorial/metorial/mcp-engine/pkg/util"
	"google.golang.org/grpc"
)

const LOCAL_SESSION_INACTIVITY_TIMEOUT = time.Second * 60 * 5

type LocalSession struct {
	WorkerType workers.WorkerType

	mcpClientInitWg    *sync.WaitGroup
	mcpClientInitMutex sync.Mutex
	mcpClient          *mcp.MCPClient

	mcpServerInitMutex sync.Mutex
	mcpServer          *mcp.MCPServer

	dbSession *db.Session
	db        *db.DB

	counter atomic.Int32

	sessionManager *Sessions

	storedSession *state.Session

	context context.Context
	cancel  context.CancelFunc

	hasError bool

	activeConnection          workers.WorkerConnection
	activeConnectionCreated   chan struct{}
	lastConnectionInteraction time.Time
	activeRunDb               *db.SessionRun

	lastSessionInteraction time.Time

	internalMessages *pubsub.Broadcaster[*mcp.MCPMessage]

	connectionInput *workers.WorkerConnectionInput

	workerManager *workers.WorkerManager

	mutex sync.RWMutex
}

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
		WorkerType: workerType,

		mcpClient:          client,
		mcpClientInitWg:    mcpClientInitWg,
		mcpClientInitMutex: sync.Mutex{},

		sessionManager: sessions,
		dbSession:      dbSession,
		db:             sessions.db,

		hasError: false,

		storedSession:   storedSession,
		connectionInput: connectionInput,

		activeConnection:          nil,
		activeConnectionCreated:   make(chan struct{}),
		lastConnectionInteraction: time.Now(),
		lastSessionInteraction:    time.Now(),

		workerManager: sessions.workerManager,

		internalMessages: pubsub.NewBroadcaster[*mcp.MCPMessage](),

		context: ctx,
		cancel:  cancel,
	}
}

func (s *LocalSession) SendMcpMessage(req *managerPb.SendMcpMessageRequest, stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse]) *mterror.MTError {
	var initMessage *mcp.MCPMessage = nil

	// Parse the MCP messages from the request
	mcpMessages := make([]*mcp.MCPMessage, 0, len(req.McpMessages))
	for _, rawMessage := range req.McpMessages {
		message, err := mcp.FromPbRawMessage(rawMessage)
		if err != nil {
			go s.db.CreateError(db.NewErrorStructuredError(
				s.dbSession,
				"mcp_message_parse_error",
				"failed to parse MCP message",
				map[string]string{
					"message":        rawMessage.Message,
					"internal_error": err.Error(),
				},
			))

			return mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "run_error", "failed to parse MCP message", err)
		}

		// Initializations are handled separately
		// they are not sent to the worker directly
		// but we need them to set the MCP client.
		// If the MCP client is not set, the `ensureConnection`
		// method will block until it is set.
		thisIsInit := *message.Method == "initialize"
		if thisIsInit {
			if initMessage != nil {
				go s.db.CreateError(db.NewErrorStructuredError(
					s.dbSession,
					"mcp_message_parse_error",
					"multiple initialize messages in request",
					map[string]string{
						"message": rawMessage.Message,
					},
				))

				return mterror.New(mterror.InvalidRequestKind, "multiple initialize messages in request")
			}

			client, err := mcp.McpClientFromInitMessage(message)
			if err != nil {
				go s.db.CreateError(db.NewErrorStructuredError(
					s.dbSession,
					"mcp_message_parse_error",
					"failed to parse MCP message, invalid initialize message",
					map[string]string{
						"message":        rawMessage.Message,
						"internal_error": err.Error(),
					},
				))

				return mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "run_error", "failed to parse MCP message, invalid initialize message", err)
			}

			s.setMcpClient(client)
			initMessage = message
		} else {
			mcpMessages = append(mcpMessages, message)
		}
	}

	// Now we need to get a handle on the connection
	// this will block until the MCP client is set
	// and the connection is established.
	connection, run, err := s.ensureConnection()
	if err != nil {
		return err
	}

	if connection == nil || run == nil {
		return mterror.New(mterror.InternalErrorKind, "no active connection for session")
	}

	go func() {
		// Persist the message in the database
		for _, message := range mcpMessages {
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
	}()

	// Wait group for this function
	// 1. Wait for responses to be sent (if enabled)
	// 2. Wait for the session and run info to be sent
	wg := sync.WaitGroup{}

	// Send session and run info
	wg.Add(1)
	go func() {
		defer wg.Done()

		pbSes, err2 := s.dbSession.ToPb()
		if err2 == nil {
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

		pbRun, err2 := run.ToPb()
		if err2 == nil {
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
	}()

	// If the client has sent and initialization message,
	// we need to handle it separately.
	if initMessage != nil {
		wg.Add(1)

		go func() {
			defer wg.Done()

			server, err := connection.GetServer()
			if err != nil {
				s.db.CreateError(db.NewErrorStructuredErrorWithRun(
					s.dbSession,
					run,
					"run_error",
					"failed to get server info",
					map[string]string{
						"internal_error": err.Error(),
					},
				))
				return
			}

			message, err := server.ToInitMessage(initMessage)
			if err != nil {
				return
			}

			s.internalMessages.Publish(message)

			// If the client has requested a response,
			// we need to send it back.
			if req.IncludeResponses {
				response := &managerPb.SendMcpMessageResponse{
					Response: &managerPb.SendMcpMessageResponse_McpMessage{
						McpMessage: message.ToPbMessage(),
					},
				}

				err = stream.Send(response)
				if err != nil {
					return
				}
			}

		}()
	}

	// If the client want responses to be sent back,
	// we need to listen for the responses
	if req.IncludeResponses {
		wg.Add(1)

		mcpRequestMessageIdsToListenFor := make([]string, 0)
		for _, message := range mcpMessages {
			if message.MsgType == mcp.RequestType {
				id := message.GetStringId()
				if id != "" && !slices.Contains(mcpRequestMessageIdsToListenFor, id) {
					mcpRequestMessageIdsToListenFor = append(mcpRequestMessageIdsToListenFor, id)
				}
			}
		}

		go func() {
			defer wg.Done()

			timeout := time.NewTimer(time.Second * 60)
			defer timeout.Stop()

			refreshTicker := time.NewTicker(time.Second * 15)
			defer refreshTicker.Stop()

			responsesToWaitFor := len(mcpRequestMessageIdsToListenFor)

			msgChan := connection.Messages().Subscribe()
			defer connection.Messages().Unsubscribe(msgChan)

			errChan := connection.Errors().Subscribe()
			defer connection.Errors().Unsubscribe(errChan)

			doneChan := connection.Done().Subscribe()
			defer connection.Done().Unsubscribe(doneChan)

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
					if responsesToWaitFor > 0 {
						response := &managerPb.SendMcpMessageResponse{
							Response: &managerPb.SendMcpMessageResponse_McpError{
								McpError: &mcpPb.McpError{
									ErrorCode:    mcpPb.McpError_timeout,
									ErrorMessage: fmt.Sprintf("timeout waiting for %d MCP responses", responsesToWaitFor),
								},
							},
						}

						err := stream.Send(response)
						if err != nil {
							log.Printf("Failed to send response message: %v", err)
							return
						}
					}

					return

				case <-timeout.C:
					if responsesToWaitFor > 0 {
						response := &managerPb.SendMcpMessageResponse{
							Response: &managerPb.SendMcpMessageResponse_McpError{
								McpError: &mcpPb.McpError{
									ErrorCode:    mcpPb.McpError_timeout,
									ErrorMessage: fmt.Sprintf("timeout waiting for %d MCP responses", responsesToWaitFor),
								},
							},
						}

						err := stream.Send(response)
						if err != nil {
							log.Printf("Failed to send response message: %v", err)
							return
						}
					}

					return

				case message := <-msgChan:
					if slices.Contains(mcpRequestMessageIdsToListenFor, message.GetStringId()) {
						response := &managerPb.SendMcpMessageResponse{
							Response: &managerPb.SendMcpMessageResponse_McpMessage{
								McpMessage: message.ToPbMessage(),
							},
						}

						err := stream.Send(response)
						if err != nil {
							log.Printf("Failed to send response message: %v", err)
							return
						}

						responsesToWaitFor--
					}

				case mcpErr := <-errChan:
					err := stream.Send(&managerPb.SendMcpMessageResponse{
						Response: &managerPb.SendMcpMessageResponse_McpError{
							McpError: mcpErr,
						},
					})
					if err != nil {
						log.Printf("Failed to send error message: %v", err)
						return
					}

					return

				}
			}
		}()
	}

	// Send the messages to the connection
	for _, message := range mcpMessages {
		err := connection.AcceptMessage(message)
		if err != nil {
			go s.db.CreateError(db.NewErrorStructuredErrorWithRun(
				s.dbSession,
				s.activeRunDb,
				"mcp_message_processing_failed",
				"failed to process MCP message",
				map[string]string{
					"message":        string(message.GetRawPayload()),
					"internal_error": err.Error(),
				},
			))

			return mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "mcp_message_processing_failed", "failed to process MCP message", err)
		}
	}

	s.Touch()
	s.lastConnectionInteraction = time.Now()

	wg.Wait()

	return nil
}

func (s *LocalSession) StreamMcpMessages(req *managerPb.StreamMcpMessagesRequest, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) *mterror.MTError {
	s.Touch()

	go func() {
		pbSes, err2 := s.dbSession.ToPb()
		if err2 == nil {
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
	}()

	if req.OnlyIds != nil && len(req.OnlyIds) == 0 {
		req.OnlyIds = nil // If no IDs are requested, we don't need to filter
	}

	if req.OnlyMessageTypes != nil && len(req.OnlyMessageTypes) == 0 {
		req.OnlyMessageTypes = nil // If no message types are requested, we don't need to filter
	}

	responsesToWaitFor := 0
	if req.OnlyIds == nil {
		responsesToWaitFor = len(req.OnlyIds)
	}

	if req.ReplayAfterUuid != nil {
		go func() {
			messages, err := s.db.ListGlobalSessionMessagesAfter(req.SessionId, *req.ReplayAfterUuid)
			if err != nil {
				log.Printf("Failed to list messages after UUID %s: %v", *req.ReplayAfterUuid, err)
				return
			}

			for _, message := range messages {
				message, err := message.ToPbMessage()
				if strings.HasPrefix(message.IdString, "mte/init/") {
					// Skip initialization messages, as they are always handled internally
					// and not by the MCP client.
					continue
				}

				if err != nil {
					log.Printf("Failed to convert message to PB message: %v", err)
					continue
				}

				response := &managerPb.StreamMcpMessagesResponse{
					Response: &managerPb.StreamMcpMessagesResponse_McpMessage{
						McpMessage: message,
					},
					IsReplay: true,
				}

				err = stream.Send(response)
				if err != nil {
					log.Printf("Failed to send replayed message: %v", err)
					return
				}
			}
		}()
	}

	var msgChan chan *mcp.MCPMessage = nil
	var errChan chan *mcpPb.McpError = nil
	var outChan chan *mcpPb.McpOutput = nil
	var doneChan chan struct{} = nil
	var chansForCon workers.WorkerConnection

	internalMessages := s.internalMessages.Subscribe()
	defer s.internalMessages.Unsubscribe(internalMessages)

	touchTicker := time.NewTicker(time.Second * 15)
	defer touchTicker.Stop()

	defer func() {
		if chansForCon != nil {
			if msgChan != nil {
				chansForCon.Messages().Unsubscribe(msgChan)
			}
			if errChan != nil {
				chansForCon.Errors().Unsubscribe(errChan)
			}
			if outChan != nil {
				chansForCon.Output().Unsubscribe(outChan)
			}
			if doneChan != nil {
				chansForCon.Done().Unsubscribe(doneChan)
			}
		}
	}()

	for {
		if req.OnlyIds != nil && responsesToWaitFor <= 0 {
			return nil
		}

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
				if s.canSendMessage(req, message) {
					responsesToWaitFor--

					response := &managerPb.StreamMcpMessagesResponse{
						Response: &managerPb.StreamMcpMessagesResponse_McpMessage{
							McpMessage: message.ToPbMessage(),
						},
					}

					err := stream.Send(response)
					if err != nil {
						log.Printf("Failed to send response message: %v", err)
						return nil
					}
				}

			case <-s.activeConnectionCreated:
				// Wait for the mutex to be released
				s.mutex.RLock()
				connection = s.activeConnection
				s.mutex.RUnlock()
			}
		}

		if connection == nil {
			continue
		}

		if chansForCon == nil || chansForCon.ConnectionID() != connection.ConnectionID() {
			if chansForCon != nil {
				if msgChan != nil {
					chansForCon.Messages().Unsubscribe(msgChan)
				}
				if errChan != nil {
					chansForCon.Errors().Unsubscribe(errChan)
				}
				if doneChan != nil {
					chansForCon.Done().Unsubscribe(doneChan)
				}
				if outChan != nil {
					chansForCon.Output().Unsubscribe(outChan)
				}
			}

			msgChan = connection.Messages().Subscribe()
			errChan = connection.Errors().Subscribe()
			outChan = connection.Output().Subscribe()
			doneChan = connection.Done().Subscribe()

			chansForCon = connection

			s.mutex.RLock()
			dbRun := s.activeRunDb
			s.mutex.RUnlock()

			if dbRun != nil {
				pbRun, err2 := dbRun.ToPb()
				if err2 == nil {
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

				pbSes, err2 := s.dbSession.ToPb()
				if err2 == nil {
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

		select {
		case <-stream.Context().Done():
			return nil
		case <-s.context.Done():
			return nil
		case <-touchTicker.C:
			s.Touch()

		case <-doneChan:
			// The connection has been closed, but the stream remains open
			// start over with the loop to wait for a new connection
			continue

		case message := <-msgChan:
			if s.canSendMessage(req, message) {
				responsesToWaitFor--

				response := &managerPb.StreamMcpMessagesResponse{
					Response: &managerPb.StreamMcpMessagesResponse_McpMessage{
						McpMessage: message.ToPbMessage(),
					},
				}

				err := stream.Send(response)
				if err != nil {
					log.Printf("Failed to send response message: %v", err)
					return nil
				}
			}

		case message := <-internalMessages:
			if s.canSendMessage(req, message) {
				responsesToWaitFor--

				response := &managerPb.StreamMcpMessagesResponse{
					Response: &managerPb.StreamMcpMessagesResponse_McpMessage{
						McpMessage: message.ToPbMessage(),
					},
				}

				err := stream.Send(response)
				if err != nil {
					log.Printf("Failed to send response message: %v", err)
					return nil
				}
			}

		case mcpErr := <-errChan:
			err := stream.Send(&managerPb.StreamMcpMessagesResponse{
				Response: &managerPb.StreamMcpMessagesResponse_McpError{
					McpError: mcpErr,
				},
			})
			if err != nil {
				log.Printf("Failed to send error message: %v", err)
				return nil
			}

		case output := <-outChan:
			err := stream.Send(&managerPb.StreamMcpMessagesResponse{
				Response: &managerPb.StreamMcpMessagesResponse_McpOutput{
					McpOutput: output,
				},
			})
			if err != nil {
				log.Printf("Failed to send output message: %v", err)
				return nil
			}

		}
	}
}

func (s *LocalSession) GetServerInfo(req *managerPb.GetServerInfoRequest) (*mcpPb.McpParticipant, *mterror.MTError) {
	s.mcpServerInitMutex.Lock()
	defer s.mcpServerInitMutex.Unlock()

	if s.mcpServer == nil {
		connection, _, err := s.ensureConnection()
		if err != nil {
			return nil, mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "run_error", "failed to ensure connection", err)
		}

		s.mutex.RLock()
		defer s.mutex.RUnlock()

		server, err2 := connection.GetServer()
		if err2 != nil {
			return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to get server info", err)
		}

		s.mcpServer = server
	}

	participant, err := s.mcpServer.ToPbParticipant()
	if err != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to convert server to participant", err)
	}

	return participant, nil
}

func (s *LocalSession) DiscardSession() *mterror.MTError {
	// The manager is responsible for discarding the session
	err := s.sessionManager.DiscardSession(s.storedSession.ID)
	if err != nil {
		go s.db.CreateError(db.NewErrorStructuredErrorWithRun(
			s.dbSession,
			s.activeRunDb,
			"discard_session_error",
			"failed to discard session",
			map[string]string{
				"internal_error": err.Error(),
			},
		))

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

	// If the last interaction with the connection was too long ago, we can discard it
	if time.Since(s.lastSessionInteraction) > LOCAL_SESSION_INACTIVITY_TIMEOUT {
		return true
	}

	return false
}

func (s *LocalSession) StoredSession() *state.Session {
	return s.storedSession
}

func (s *LocalSession) SessionRecord() (*db.Session, *mterror.MTError) {
	return s.dbSession, nil
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

func (s *LocalSession) canSendMessage(req *managerPb.StreamMcpMessagesRequest, message *mcp.MCPMessage) bool {
	if req.OnlyIds != nil && !slices.Contains(req.OnlyIds, message.GetStringId()) {
		return false
	}

	if req.OnlyMessageTypes != nil && !slices.Contains(req.OnlyMessageTypes, message.GetPbMessageType()) {
		return false
	}

	return true
}

func (s *LocalSession) ensureConnection() (workers.WorkerConnection, *db.SessionRun, *mterror.MTError) {
	// Wait until the MCP client is initialized
	s.mcpClientInitWg.Wait()

	s.mutex.RLock()

	if s.activeConnection != nil {
		s.mutex.RUnlock()
		s.Touch()
		s.lastConnectionInteraction = time.Now()

		return s.activeConnection, s.activeRunDb, nil // Connection already exists
	}

	s.mutex.RUnlock()

	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Double-check if the connection was created while waiting for the lock
	if s.activeConnection != nil {
		return s.activeConnection, s.activeRunDb, nil
	}

	connectionInput := s.connectionInput
	// Update the connection input with the session ID and a new connection ID
	connectionInput.ConnectionID = util.Must(uuid.NewV7()).String()
	connectionInput.MCPClient = s.mcpClient

	hash, err := s.workerManager.GetConnectionHashForWorkerType(s.WorkerType, connectionInput)
	if err != nil {
		log.Printf("Failed to get connection hash for worker type %s: %v", s.WorkerType, err)
		return nil, nil, mterror.NewWithInnerError(mterror.InternalErrorKind, fmt.Sprintf("failed to get connection hash for worker type: %s", err.Error()), err)
	}

	worker, ok := s.workerManager.PickWorkerByHash(s.WorkerType, hash)
	if !ok {
		log.Printf("No available worker for worker type %s with hash %s", s.WorkerType, hash)
		return nil, nil, mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "run_error", "no available worker for worker type", err)
	}

	connection, err := worker.CreateConnection(connectionInput)
	if err != nil {
		log.Printf("Failed to create connection for worker %s: %v", worker.WorkerID(), err)
		return nil, nil, mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "run_error", "failed to create connection for worker", err)
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

	run, err := s.db.CreateRun(
		db.NewRun(
			connection.ConnectionID(),
			worker.WorkerID(),
			s.dbSession,
			connectionType,
			db.SessionRunStatusActive,
		),
	)
	s.activeRunDb = run
	if err != nil {
		return nil, nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to create connection in database", err)
	}

	log.Printf("Created connection %s for session %s with worker %s", connection.ConnectionID(), s.storedSession.ID, worker.WorkerID())

	go s.monitorConnection(run, connection)

	err = connection.Start()
	if err != nil {
		go s.db.CreateError(db.NewErrorStructuredErrorWithRun(
			s.dbSession,
			run,
			"run_error",
			"failed to start/connect to server",
			map[string]string{
				"internal_error": err.Error(),
			},
		))

		return nil, nil, mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "run_error", "failed to start server", err)
	}

	log.Printf("Started connection %s for session %s with worker %s", connection.ConnectionID(), s.storedSession.ID, worker.WorkerID())

	s.activeConnection = connection
	s.lastConnectionInteraction = time.Now()
	s.lastSessionInteraction = time.Now()

	if s.mcpServer == nil {
		go func() {
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
				return // MCP server already initialized
			}

			server, err2 := connection.GetServer()
			if err2 != nil {
				return
			}

			s.mcpServer = server
		}()
	}

	defer func() {
		// Send to activeConnectionCreated without blocking
		select {
		case s.activeConnectionCreated <- struct{}{}:
		default:
		}
	}()

	return connection, run, nil
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
			return fmt.Errorf("failed to close active connection: %w", err)
		}
	}

	if dbErr != nil {
		return fmt.Errorf("failed to save session in database: %w", dbErr)
	}

	return nil
}

func (s *LocalSession) monitorConnection(run *db.SessionRun, connection workers.WorkerConnection) {
	timeout := connection.InactivityTimeout()

	ticker := time.NewTicker(time.Second * 5)
	defer ticker.Stop()

	doneChan := connection.Done().Subscribe()
	defer connection.Done().Unsubscribe(doneChan)

	errChan := connection.Errors().Subscribe()
	defer connection.Errors().Unsubscribe(errChan)

	msgChan := connection.Messages().Subscribe()
	defer connection.Messages().Unsubscribe(msgChan)

	outChan := connection.Output().Subscribe()
	defer connection.Output().Unsubscribe(outChan)

loop:
	for {
		select {
		case <-ticker.C:
			if time.Since(s.lastConnectionInteraction) > timeout {
				s.mutex.Lock()
				if s.activeConnection != nil && s.activeConnection.ConnectionID() == connection.ConnectionID() {
					s.activeConnection = nil

					if run.Status == db.SessionRunStatusActive {
						run.EndedAt = db.NullTimeNow()
						run.Status = db.SessionRunStatusExpired
						s.db.SaveRun(run)
					}

					go connection.Close()

					log.Printf("Connection %s for session %s has been closed due to inactivity", connection.ConnectionID(), s.storedSession.ID)
				}
				s.mutex.Unlock()

				break loop
			} else if s.activeConnection != nil && s.activeConnection.ConnectionID() != connection.ConnectionID() {
				// I'm pretty sure this can't happen, but just in case
				// clean up the old connection if it has been replaced
				err := connection.Close()
				if err != nil {
					log.Printf("Failed to close old connection %s: %v", connection.ConnectionID(), err)
				}

				s.mutex.Lock()
				if run.Status == db.SessionRunStatusActive {
					run.EndedAt = db.NullTimeNow()
					run.Status = db.SessionRunStatusExpired
					s.db.SaveRun(run)
				}
				s.mutex.Unlock()
			}

		case <-doneChan:
			s.mutex.Lock()
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
			s.mutex.Unlock()

			break loop

		case err := <-errChan:
			s.hasError = true

			go s.db.CreateError(db.NewErrorFromMcp(
				s.dbSession,
				run,
				err,
			))

		case message := <-msgChan:
			go s.db.CreateMessage(
				db.NewMessage(
					s.dbSession,
					run,
					int(s.counter.Add(1)),
					db.SessionMessageSenderServer,
					message,
				),
			)

		case output := <-outChan:
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

func (s *LocalSession) Touch() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.lastSessionInteraction = time.Now()

	if s.dbSession != nil && time.Since(s.dbSession.LastPingAt) > time.Second*60 {
		s.dbSession.LastPingAt = time.Now()
		err := s.db.SaveSession(s.dbSession)
		if err != nil {
			log.Printf("Failed to update last ping time for session %s: %v", s.dbSession.ID, err)
		}
	}

	if s.activeRunDb != nil && time.Since(s.activeRunDb.LastPingAt) > time.Second*60 {
		s.activeRunDb.LastPingAt = time.Now()
		err := s.db.SaveRun(s.activeRunDb)
		if err != nil {
			log.Printf("Failed to update last ping time for connection %s: %v", s.activeRunDb.ID, err)
		}
	}
}
