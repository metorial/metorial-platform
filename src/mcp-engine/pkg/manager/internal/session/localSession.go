package session

import (
	"context"
	"fmt"
	"log"
	"slices"
	"sync"
	"time"

	"github.com/google/uuid"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/manager/internal/state"
	"github.com/metorial/metorial/mcp-engine/pkg/manager/internal/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mt-error"
	"google.golang.org/grpc"
)

const LOCAL_SESSION_INACTIVITY_TIMEOUT = time.Second * 60 * 5

type LocalSession struct {
	WorkerType workers.WorkerType
	McpClient  *mcp.MCPClient

	sessionManager *Sessions

	storedSession *state.Session

	context context.Context
	cancel  context.CancelFunc

	activeConnection          workers.WorkerConnection
	activeConnectionCreated   chan struct{}
	lastConnectionInteraction time.Time

	connectionInput *workers.WorkerConnectionInput

	workerManager *workers.WorkerManager

	mutex sync.RWMutex
}

func (s *LocalSession) SendMcpMessage(req *managerPb.SendMcpMessageRequest, stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse]) *mterror.MTError {
	err := s.ensureConnection()
	if err != nil {
		return err
	}

	mcpMessages := make([]*mcp.MCPMessage, 0, len(req.McpMessages))
	for _, rawMessage := range req.McpMessages {
		message, err := mcp.FromPbRawMessage(rawMessage)
		if err != nil {
			return mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "runner_connection_error", "failed to parse MCP message", err)
		}

		mcpMessages = append(mcpMessages, message)
	}

	wg := sync.WaitGroup{}

	s.mutex.RLock()
	// Since the messages are sent to the same connection,
	// we can just hold on to the current active connection,
	// and don't need to consider new connections.
	connection := s.activeConnection
	if connection == nil {
		return mterror.New(mterror.InternalErrorKind, "no active connection for session")
	}
	s.mutex.RUnlock()

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

				s.touch()

				select {
				case <-stream.Context().Done():
				case <-s.context.Done():
					return

				case <-doneChan:
				case <-timeout.C:
					if responsesToWaitFor > 0 {
						response := &managerPb.SendMcpMessageResponse{
							ResponseType: managerPb.SendMcpMessageResponse_message,
							McpError: &mcpPb.McpError{
								ErrorCode:    mcpPb.McpError_timeout,
								ErrorMessage: fmt.Sprintf("timeout waiting for %d MCP responses", responsesToWaitFor),
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
							ResponseType:       managerPb.SendMcpMessageResponse_message,
							McpResponseMessage: message.ToPbMessage(),
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
						ResponseType: managerPb.SendMcpMessageResponse_error,
						McpError:     mcpErr,
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

	for _, message := range mcpMessages {
		err := connection.AcceptMessage(message)
		if err != nil {
			return mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "mcp_message_processing_failed", "failed to accept MCP message", err)
		}
	}

	s.touch()

	wg.Wait()

	return nil
}

func (s *LocalSession) StreamMcpMessages(req *managerPb.StreamMcpMessagesRequest, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) *mterror.MTError {
	responsesToWaitFor := 0
	if req.OnlyIds == nil {
		responsesToWaitFor = len(req.OnlyIds)
	}

	var msgChan chan *mcp.MCPMessage = nil
	var errChan chan *mcpPb.McpError = nil
	var outChan chan *mcpPb.McpOutput = nil
	var doneChan chan struct{} = nil
	chansForConId := ""

	defer func() {
		s.mutex.RLock()
		defer s.mutex.RUnlock()

		if s.activeConnection == nil {
			return
		}

		if msgChan != nil {
			s.activeConnection.Messages().Unsubscribe(msgChan)
		}
		if errChan != nil {
			s.activeConnection.Errors().Unsubscribe(errChan)
		}
		if outChan != nil {
			s.activeConnection.Output().Unsubscribe(outChan)
		}
		if doneChan != nil {
			s.activeConnection.Done().Unsubscribe(doneChan)
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
			case <-s.context.Done():
				return nil

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

		if chansForConId != connection.ConnectionID() {
			if msgChan != nil {
				connection.Messages().Unsubscribe(msgChan)
			}

			if errChan != nil {
				connection.Errors().Unsubscribe(errChan)
			}

			if doneChan != nil {
				connection.Done().Unsubscribe(doneChan)
			}

			if outChan != nil {
				connection.Output().Unsubscribe(outChan)
			}

			msgChan = connection.Messages().Subscribe()
			errChan = connection.Errors().Subscribe()
			outChan = connection.Output().Subscribe()
			doneChan = connection.Done().Subscribe()
			chansForConId = connection.ConnectionID()
		}

		select {
		case <-stream.Context().Done():
		case <-s.context.Done():
			return nil

		case <-doneChan:
			// The connection has been closed, but the stream remains open
			// start over with the loop to wait for a new connection
			continue

		case message := <-msgChan:
			canSend := true

			if req.OnlyIds != nil {
				if slices.Contains(req.OnlyIds, message.GetStringId()) {
					responsesToWaitFor--
				} else {
					canSend = false
				}
			}

			if req.OnlyMessageTypes != nil {
				if !slices.Contains(req.OnlyMessageTypes, message.GetPbMessageType()) {
					canSend = false
				}
			}

			if canSend {
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
	err := s.ensureConnection()
	if err != nil {
		return nil, mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "runner_connection_error", "failed to ensure connection", err)
	}

	s.mutex.RLock()
	defer s.mutex.RUnlock()

	server, err2 := s.activeConnection.GetServer()
	if err2 != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to get server info", err)
	}

	participant, err2 := server.ToPbParticipant()
	if err2 != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to convert server to participant", err)
	}

	return participant, nil
}

func (s *LocalSession) DiscardSession() *mterror.MTError {
	// The manager is responsible for discarding the session
	err := s.sessionManager.DiscardSession(s.storedSession.ID)
	if err != nil {
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
	if time.Since(s.lastConnectionInteraction) > LOCAL_SESSION_INACTIVITY_TIMEOUT {
		return true
	}

	return false
}

func (s *LocalSession) StoredSession() *state.Session {
	return s.storedSession
}

func (s *LocalSession) ensureConnection() *mterror.MTError {
	s.mutex.RLock()

	if s.activeConnection != nil {
		s.mutex.RUnlock()
		s.touch()

		return nil // Connection already exists
	}

	s.mutex.RUnlock()

	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Double-check if the connection was created while waiting for the lock
	if s.activeConnection != nil {
		return nil
	}

	connectionInput := s.connectionInput
	// Update the connection input with the session ID and a new connection ID
	connectionInput.ConnectionID = uuid.NewString()

	hash, err := s.workerManager.GetConnectionHashForWorkerType(s.WorkerType, connectionInput)
	if err != nil {
		return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to get connection hash for worker type", err)
	}

	worker, ok := s.workerManager.PickWorkerByHash(s.WorkerType, hash)
	if !ok {
		return mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "runner_connection_error", "no available worker for worker type", err)
	}

	connection, err := worker.CreateConnection(connectionInput)
	if err != nil {
		return mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "runner_connection_error", "failed to create connection for worker", err)
	}

	log.Printf("Created connection %s for session %s with worker %s", connection.ConnectionID(), s.storedSession.ID, worker.WorkerID())

	err = connection.Start()
	if err != nil {
		return mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "runner_connection_error", "failed to start connection", err)
	}

	log.Printf("Started connection %s for session %s with worker %s", connection.ConnectionID(), s.storedSession.ID, worker.WorkerID())

	s.activeConnection = connection
	s.lastConnectionInteraction = time.Now()

	go s.monitorConnection(connection)

	defer func() {
		// Send to activeConnectionCreated without blocking
		select {
		case s.activeConnectionCreated <- struct{}{}:
		default:
		}
	}()

	return nil
}

func (s *LocalSession) stop() error {

	s.mutex.Lock()
	defer s.mutex.Unlock()

	close(s.activeConnectionCreated)
	s.activeConnectionCreated = nil

	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}

	if s.activeConnection != nil {
		err := s.activeConnection.Close()
		s.activeConnection = nil
		if err != nil {
			return fmt.Errorf("failed to close active connection: %w", err)
		}
	}

	return nil
}

func (s *LocalSession) monitorConnection(connection workers.WorkerConnection) {
	timeout := connection.InactivityTimeout()

	ticker := time.NewTicker(time.Second * 5)
	defer ticker.Stop()

	doneChan := connection.Done().Subscribe()
	defer connection.Done().Unsubscribe(doneChan)

loop:
	for {
		select {
		case <-ticker.C:
			if time.Since(s.lastConnectionInteraction) > timeout {
				s.mutex.Lock()
				if s.activeConnection != nil && s.activeConnection.ConnectionID() == connection.ConnectionID() {
					s.activeConnection = nil
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
			}

		case <-doneChan:
			s.mutex.Lock()
			if s.activeConnection != nil && s.activeConnection.ConnectionID() == connection.ConnectionID() {
				s.activeConnection = nil
			}
			s.mutex.Unlock()
			break loop
		}
	}

	log.Printf("Connection %s for session %s has been closed", connection.ConnectionID(), s.storedSession.ID)
}

func (s *LocalSession) touch() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.lastConnectionInteraction = time.Now()
}
