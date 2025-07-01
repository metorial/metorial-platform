package session

import (
	"fmt"
	"log"
	"slices"
	"sync"
	"time"

	"github.com/google/uuid"
	managerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/manager"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/state"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/workers"
	"github.com/metorial/metorial/mcp-broker/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-broker/pkg/mt-error"
	"google.golang.org/grpc"
)

const LOCAL_SESSION_INACTIVITY_TIMEOUT = 1000 * 60 * 5

type LocalSession struct {
	WorkerType workers.WorkerType
	McpClient  *mcp.MCPClient

	storedSession *state.Session

	activeConnection          workers.WorkerConnection
	lastConnectionInteraction time.Time

	sessionConfig *managerPb.SessionConfig

	workerManager *workers.WorkerManager

	mutex sync.RWMutex
}

func (s *LocalSession) SendMcpMessage(req *managerPb.SendMcpMessageRequest, stream grpc.ServerStreamingServer[managerPb.SendMcpMessageResponse]) *mterror.MTError {
	s.ensureConnection()

	s.mutex.RLock()
	defer s.mutex.RUnlock()

	mcpMessages := make([]*mcp.MCPMessage, 0, len(req.McpMessages))
	for _, rawMessage := range req.McpMessages {
		message, err := mcp.FromPbRawMessage(rawMessage)
		if err != nil {
			return mterror.NewWithInnerError(mterror.InvalidRequestCode, "failed to parse MCP message", err)
		}

		mcpMessages = append(mcpMessages, message)
	}

	wg := sync.WaitGroup{}

	if req.IncludeResponses {
		wg.Add(1)

		mcpRequestMessageIdsToListenFor := make([]string, 0)
		for _, message := range mcpMessages {
			if message.MsgType == mcp.RequestType {
				id := message.GetStringId()
				if id != "" {
					mcpRequestMessageIdsToListenFor = append(mcpRequestMessageIdsToListenFor, id)
				}
			}
		}

		go func() {
			defer wg.Done()

			s.mutex.RLock()
			defer s.mutex.RUnlock()

			responsesToWaitFor := len(mcpRequestMessageIdsToListenFor)

			for {
				if responsesToWaitFor <= 0 {
					return
				}

				select {
				case <-stream.Context().Done():
					return

				case <-s.activeConnection.Done():
					return

				case message := <-s.activeConnection.Messages():
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

						s.lastConnectionInteraction = time.Now()
						responsesToWaitFor--
					}

				case mcpErr := <-s.activeConnection.Errors():
					response := &managerPb.SendMcpMessageResponse{
						ResponseType: managerPb.SendMcpMessageResponse_error,
						McpError:     mcpErr,
					}
					err := stream.Send(response)
					if err != nil {
						log.Printf("Failed to send error message: %v", err)
						return
					}
				}
			}
		}()
	}

	for _, message := range mcpMessages {
		err := s.activeConnection.AcceptMessage(message)
		if err != nil {
			return mterror.NewWithInnerError(mterror.InternalErrorCode, "failed to process MCP message", err)
		}

		s.lastConnectionInteraction = time.Now()
	}

	wg.Wait()

	return nil
}

func (s *LocalSession) StreamMcpMessages(req *managerPb.StreamMcpMessagesRequest, stream grpc.ServerStreamingServer[managerPb.StreamMcpMessagesResponse]) *mterror.MTError {
	return nil
}

func (s *LocalSession) GetServerInfo(req *managerPb.GetServerInfoRequest) (*mcp.MCPServer, *mterror.MTError) {
	s.ensureConnection()

	s.mutex.RLock()
	defer s.mutex.RUnlock()

	server, err := s.activeConnection.GetServer()
	if err != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorCode, "failed to get server info", err)
	}

	return server, nil
}

func (s *LocalSession) CanDiscard() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// Never discard a session that has an active connection
	if s.activeConnection == nil {
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

// func (s *LocalSession) Messages() <-chan mcp.MCPMessage {
// 	s.ensureConnection()

// 	s.mutex.RLock()
// 	defer s.mutex.RUnlock()

// 	return s.activeConnection.Messages()
// }

// func (s *LocalSession) Output() <-chan *mcpPb.McpOutput {
// 	s.ensureConnection()

// 	s.mutex.RLock()
// 	defer s.mutex.RUnlock()

// 	return s.activeConnection.Output()
// }

// func (s *LocalSession) Errors() <-chan *mcpPb.McpError {
// 	s.ensureConnection()

// 	s.mutex.RLock()
// 	defer s.mutex.RUnlock()

// 	return s.activeConnection.Errors()
// }

func (s *LocalSession) ensureConnection() error {
	s.mutex.RLock()

	if s.activeConnection != nil {
		s.mutex.RUnlock()
		return nil // Connection already exists
	}

	s.mutex.RUnlock()

	s.mutex.Lock()
	defer s.mutex.Unlock()

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

	s.activeConnection = connection
	s.lastConnectionInteraction = time.Now()

	err = connection.Start()
	if err != nil {
		return fmt.Errorf("failed to start connection for worker %w", err)
	}

	go s.monitorConnection(connection)

	return nil
}

func (s *LocalSession) stop() error {
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

	ticker := time.NewTicker(5)
	defer ticker.Stop()

loop:
	for {
		select {
		case <-ticker.C:
			if time.Since(s.lastConnectionInteraction) > timeout {
				s.mutex.Lock()
				if s.activeConnection != nil && s.activeConnection.ConnectionID() == connection.ConnectionID() {
					s.activeConnection.Close()
					s.activeConnection = nil
				}
				s.mutex.Unlock()
				break loop
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
}
