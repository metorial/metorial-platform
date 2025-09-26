package session

import (
	"context"
	"fmt"
	"log"
	"slices"
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
	"github.com/metorial/metorial/modules/pubsub"
	"google.golang.org/grpc"
)

type LocalSession struct {
	WorkerType workers.WorkerType

	mcpClientInitWg    *sync.WaitGroup
	mcpClientInitMutex sync.Mutex
	mcpClient          *mcp.MCPClient

	mcpServerInitMutex sync.Mutex
	mcpServer          *mcp.MCPServer

	serverDiscoveryMutex sync.Mutex

	dbSession *db.Session
	db        *db.DB

	sendMu *sync.Mutex

	counter atomic.Int32

	sessionManager *Sessions

	storedSession *state.Session

	context context.Context
	cancel  context.CancelFunc

	hasError bool

	activeConnection          workers.WorkerConnection
	activeConnectionCreated   *pubsub.Broadcaster[any]
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

		sendMu: &sync.Mutex{},

		hasError: false,

		storedSession:   storedSession,
		connectionInput: connectionInput,

		activeConnection:          nil,
		activeConnectionCreated:   pubsub.NewBroadcaster[any](),
		lastConnectionInteraction: time.Now(),
		lastSessionInteraction:    time.Now(),

		workerManager: sessions.workerManager,

		internalMessages: pubsub.NewBroadcaster[*mcp.MCPMessage](),

		context: ctx,
		cancel:  cancel,
	}
}

func (s *LocalSession) SendMcpMessage(req *managerPb.SendMcpMessageRequest, stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse]) *mterror.MTError {
	initMessage, mcpMessages, err := s.parseMessages(req)
	if err != nil {
		return err
	}

	go func() {
		sendStreamResponseSessionEventInfoSession(s.sendMu, stream, s.dbSession)
	}()

	// Now we need to get a handle on the connection
	// this will block until the MCP client is set
	// and the connection is established.
	connection, run, err := s.ensureConnection()
	if err != nil {
		sentry.CaptureException(err)
		return err
	}

	if connection == nil || run == nil {
		return mterror.New(mterror.InternalErrorKind, "no active connection for session")
	}

	go s.PersistMessages(run, db.SessionMessageSenderClient, mcpMessages)

	// Wait group for this function
	// 1. Wait for responses to be sent (if enabled)
	// 2. Wait for the session and run info to be sent
	wg := sync.WaitGroup{}

	// Send session and run info
	wg.Add(1)
	go func() {
		defer wg.Done()

		sendStreamResponseSessionEventInfoSession(s.sendMu, stream, s.dbSession)
		sendStreamResponseSessionEventInfoRun(s.sendMu, stream, run)
	}()

	// If the client has sent and initialization message,
	// we need to handle it separately.
	if initMessage != nil {
		wg.Add(1)

		go func() {
			defer wg.Done()

			err := s.handleInitMessage(
				initMessage,
				connection,
				run,
				stream,
				req.IncludeResponses,
			)
			if err != nil {
				log.Printf("Failed to handle init message: %v", err)
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

			refreshTicker := time.NewTicker(time.Second * 10)
			defer refreshTicker.Stop()

			responsesToWaitFor := len(mcpRequestMessageIdsToListenFor)

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
					if responsesToWaitFor > 0 {
						err := sendStreamResponseMcpError(s.sendMu, stream, &mcpPb.McpError{
							ErrorCode:    mcpPb.McpError_timeout,
							ErrorMessage: fmt.Sprintf("timeout waiting for %d MCP responses", responsesToWaitFor),
						})
						if err != nil {
							log.Printf("Failed to send response message: %v", err)
							return
						}
					}

					return

				case <-timeout.C:
					if responsesToWaitFor > 0 {
						err := sendStreamResponseMcpError(s.sendMu, stream, &mcpPb.McpError{
							ErrorCode:    mcpPb.McpError_timeout,
							ErrorMessage: fmt.Sprintf("timeout waiting for %d MCP responses", responsesToWaitFor),
						})
						if err != nil {
							log.Printf("Failed to send response message: %v", err)
							return
						}
					}

					return

				case message := <-msgChan:
					if slices.Contains(mcpRequestMessageIdsToListenFor, message.GetStringId()) {
						responsesToWaitFor--
						err := sendStreamResponseMcpMessage(s.sendMu, stream, message)
						if err != nil {
							return
						}
					}

				case message := <-internalMessages:
					if slices.Contains(mcpRequestMessageIdsToListenFor, message.GetStringId()) {
						responsesToWaitFor--
						err := sendStreamResponseMcpMessage(s.sendMu, stream, message)
						if err != nil {
							return
						}
					}

				case mcpErr := <-errChan:
					sendStreamResponseMcpError(s.sendMu, stream, mcpErr)
					return

				}
			}
		}()
	}

	// Send the messages to the connection
	for _, message := range mcpMessages {
		err := connection.AcceptMessage(message)
		if err != nil {
			sentry.CaptureException(err)
			s.CreateStructuredErrorWithRun(
				s.activeRunDb,
				"mcp_message_processing_failed",
				"failed to process MCP message",
				map[string]string{
					"message":        string(message.GetRawPayload()),
					"internal_error": err.Error(),
				},
			)

			return mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "mcp_message_processing_failed", "failed to process MCP message", err)
		}
	}

	s.Touch()
	s.lastConnectionInteraction = time.Now()

	wg.Wait()

	return nil
}

func (s *LocalSession) StreamMcpMessages(req *managerPb.StreamMcpMessagesRequest, stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse]) *mterror.MTError {
	s.Touch()

	go sendStreamResponseSessionEventInfoSession(s.sendMu, stream, s.dbSession)

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
				sentry.CaptureException(err)
				log.Printf("Failed to list messages after UUID %s: %v", *req.ReplayAfterUuid, err)
				return
			}

			for _, message := range messages {
				message, err := message.ToMcpMessage()

				if err != nil {
					log.Printf("Failed to convert message to mco message: %v", err)
					continue
				}

				err = sendStreamResponseMcpMessageReplay(s.sendMu, stream, message)
				if err != nil {
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

	activeConnectionCreated := s.activeConnectionCreated.Subscribe()
	defer s.activeConnectionCreated.Unsubscribe(activeConnectionCreated)

	touchTicker := time.NewTicker(time.Second * 15)
	defer touchTicker.Stop()

	defer func() {
		if chansForCon != nil {
			chansForCon.Messages().Unsubscribe(msgChan)
			chansForCon.Errors().Unsubscribe(errChan)
			chansForCon.Output().Unsubscribe(outChan)
			chansForCon.Done().Unsubscribe(doneChan)
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
					err := sendStreamResponseMcpMessage(s.sendMu, stream, message)
					if err != nil {
						log.Printf("Failed to send response message: %v", err)
						return nil
					}
				}

			case <-activeConnectionCreated:
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
				chansForCon.Messages().Unsubscribe(msgChan)
				chansForCon.Errors().Unsubscribe(errChan)
				chansForCon.Done().Unsubscribe(doneChan)
				chansForCon.Output().Unsubscribe(outChan)
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
				sendStreamResponseSessionEventInfoRun(s.sendMu, stream, dbRun)
				sendStreamResponseSessionEventInfoSession(s.sendMu, stream, s.dbSession)
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
				err := sendStreamResponseMcpMessage(s.sendMu, stream, message)
				if err != nil {
					return nil
				}
			}

		case message := <-internalMessages:
			if s.canSendMessage(req, message) {
				responsesToWaitFor--
				err := sendStreamResponseMcpMessage(s.sendMu, stream, message)
				if err != nil {
					return nil
				}
			}

		case mcpErr := <-errChan:
			err := sendStreamResponseMcpError(s.sendMu, stream, mcpErr)
			if err != nil {
				log.Printf("Failed to send error message: %v", err)
				return nil
			}

		case output := <-outChan:
			err := sendStreamResponseMcpOutput(s.sendMu, stream, output)
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
			sentry.CaptureException(err)
			return nil, mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "run_error", "failed to ensure connection", err)
		}

		s.mutex.RLock()
		defer s.mutex.RUnlock()

		server, err2 := connection.GetServer()
		if err2 != nil {
			sentry.CaptureException(err2)
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
