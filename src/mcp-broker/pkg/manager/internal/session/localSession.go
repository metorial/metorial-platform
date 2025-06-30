package session

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	managerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/manager"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/state"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/workers"
	"github.com/metorial/metorial/mcp-broker/pkg/mcp"
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

func (s *LocalSession) SendMcpMessage(request *managerPb.SendMcpMessageRequest) (*managerPb.SendMcpMessageResponse, error) {
	s.ensureConnection()

	s.mutex.RLock()
	defer s.mutex.RUnlock()

	for _, rawMessage := range request.McpMessages {
		message, err := mcp.FromPbRawMessage(rawMessage)
		if err != nil {
			return nil, err
		}

		err = s.activeConnection.AcceptMessage(message)
		if err != nil {
			return nil, fmt.Errorf("failed to process message: %w", err)
		}

		s.lastConnectionInteraction = time.Now()
	}

	return &managerPb.SendMcpMessageResponse{}, nil
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
