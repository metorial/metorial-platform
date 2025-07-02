package session

import (
	"fmt"
	"log"
	"slices"
	"sync"
	"time"

	"github.com/google/uuid"
	managerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/manager"
	mcpPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/mcp"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/state"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/workers"
	"github.com/metorial/metorial/mcp-broker/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-broker/pkg/mt-error"
	"google.golang.org/grpc"
)

const LOCAL_SESSION_INACTIVITY_TIMEOUT = time.Second * 60 * 5

type LocalSession struct {
	WorkerType workers.WorkerType
	McpClient  *mcp.MCPClient

	storedSession *state.Session

	activeConnection          workers.WorkerConnection
	activeConnectionCreated   chan struct{}
	lastConnectionInteraction time.Time

	sessionConfig *managerPb.SessionConfig

	workerManager *workers.WorkerManager

	mutex sync.RWMutex
}

func (s *LocalSession) SendMcpMessage(req *managerPb.SendMcpMessageRequest, stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse]) *mterror.MTError {
	err := s.ensureConnection()
	if err != nil {
		return mterror.NewWithInnerError(mterror.InternalErrorCode, "failed to ensure connection", err)
	}

	mcpMessages := make([]*mcp.MCPMessage, 0, len(req.McpMessages))
	for _, rawMessage := range req.McpMessages {
		message, err := mcp.FromPbRawMessage(rawMessage)
		if err != nil {
			return mterror.NewWithInnerError(mterror.InvalidRequestCode, "failed to parse MCP message", err)
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
		return mterror.New(mterror.InternalErrorCode, "no active connection for session")
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

			timeout := time.NewTimer(time.Second * 30)
			defer timeout.Stop()

			responsesToWaitFor := len(mcpRequestMessageIdsToListenFor)

			for {
				if responsesToWaitFor <= 0 {
					return
				}

				s.touch()

				select {
				case <-stream.Context().Done():
					return

				case <-connection.Done():
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

				case message := <-connection.Messages():
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

				case mcpErr := <-connection.Errors():
					err := stream.Send(&managerPb.SendMcpMessageResponse{
						ResponseType: managerPb.SendMcpMessageResponse_error,
						McpError:     mcpErr,
					})
					if err != nil {
						log.Printf("Failed to send error message: %v", err)
						return
					}
				}
			}
		}()
	}

	for _, message := range mcpMessages {
		err := connection.AcceptMessage(message)
		if err != nil {
			return mterror.NewWithInnerError(mterror.InternalErrorCode, "failed to process MCP message", err)
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

	for {
		if req.OnlyIds != nil && responsesToWaitFor <= 0 {
			return nil
		}

		connection := s.activeConnection
		if connection == nil {
			select {
			case <-stream.Context().Done():
				return nil
			case <-s.activeConnectionCreated:
				// Wait for the mutex to be released
				s.mutex.RLock()
				connection = s.activeConnection
				s.mutex.RUnlock()
			}
		}

		if connection == nil {
			log.Println("No active connection found, waiting for one to be created")
			continue
		}

		select {
		case <-stream.Context().Done():
			return nil

		case <-connection.Done():
			// The connection has been closed, but the stream remains open
			// start over with the loop to wait for a new connection
			continue

		case message := <-connection.Messages():
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
					ResponseType:       managerPb.StreamMcpMessagesResponse_message,
					McpResponseMessage: message.ToPbMessage(),
				}

				err := stream.Send(response)
				if err != nil {
					log.Printf("Failed to send response message: %v", err)
					return nil
				}
			}

		case mcpErr := <-connection.Errors():
			err := stream.Send(&managerPb.StreamMcpMessagesResponse{
				ResponseType: managerPb.StreamMcpMessagesResponse_error,
				McpError:     mcpErr,
			})
			if err != nil {
				log.Printf("Failed to send error message: %v", err)
				return nil
			}
		}
	}
}

func (s *LocalSession) GetServerInfo(req *managerPb.GetServerInfoRequest) (*mcpPb.McpParticipant, *mterror.MTError) {
	err := s.ensureConnection()
	if err != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorCode, "failed to ensure connection", err)
	}

	s.mutex.RLock()
	defer s.mutex.RUnlock()

	server, err := s.activeConnection.GetServer()
	if err != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorCode, "failed to get server info", err)
	}

	participant, err := server.ToPbParticipant()
	if err != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorCode, "failed to convert server to participant", err)
	}

	return participant, nil
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

func (s *LocalSession) ensureConnection() error {
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

	connectionInput := &workers.WorkerConnectionInput{
		SessionID:    s.storedSession.ID,
		ConnectionID: uuid.NewString(),

		MCPClient: s.McpClient,
	}

	if s.sessionConfig.ConfigType == nil {
		return fmt.Errorf("session config is not set for session %s", s.storedSession.ID)
	}

	if s.sessionConfig.GetRunConfigWithLauncher() != nil {
		panic("TODO: implement RunConfigWithLauncher for LocalSession")
	} else if s.sessionConfig.GetRunConfigWithContainerArguments() != nil {
		connectionInput.RunConfig = s.sessionConfig.GetRunConfigWithContainerArguments()
	} else {
		return fmt.Errorf("unsupported session config type for session %s", s.storedSession.ID)
	}

	hash, err := s.workerManager.GetConnectionHashForWorkerType(s.WorkerType, connectionInput)
	if err != nil {
		return fmt.Errorf("failed to get connection hash for worker type %s: %w", s.WorkerType, err)
	}

	worker, ok := s.workerManager.PickWorkerByHash(s.WorkerType, hash)
	if !ok {
		return fmt.Errorf("no available worker for worker type %s with hash %s", s.WorkerType, hash)
	}

	connection, err := worker.CreateConnection(connectionInput)
	if err != nil {
		return fmt.Errorf("failed to create connection for worker %w", err)
	}

	log.Printf("Created connection %s for session %s with worker %s", connection.ConnectionID(), s.storedSession.ID, worker.WorkerID())

	s.activeConnection = connection
	s.lastConnectionInteraction = time.Now()

	err = connection.Start()
	if err != nil {
		return fmt.Errorf("failed to start connection for worker %w", err)
	}

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
	close(s.activeConnectionCreated)
	s.activeConnectionCreated = nil
	s.mutex.Unlock()

	return s.closeActiveConnection()
}

func (s *LocalSession) closeActiveConnection() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

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

loop:
	for {
		select {
		case <-ticker.C:
			if time.Since(s.lastConnectionInteraction) > timeout {
				s.mutex.Lock()
				if s.activeConnection != nil && s.activeConnection.ConnectionID() == connection.ConnectionID() {
					s.activeConnection = nil
					go connection.Close()
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

		case <-connection.Done():
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
