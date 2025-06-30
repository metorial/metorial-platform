package session

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	mcpPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/mcp"
	runnerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/runner"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/workers"
	"github.com/metorial/metorial/mcp-broker/pkg/mcp"
)

type Session struct {
	SessionID  string
	WorkerType workers.WorkerType
	McpClient  *mcp.MCPClient

	activeConnection          workers.WorkerConnection
	lastConnectionInteraction time.Time

	runConfig     *runnerPb.RunConfig
	workerManager *workers.WorkerManager

	mutex sync.RWMutex
}

func NewRunnerSession(workerManager *workers.WorkerManager, client *mcp.MCPClient, runConfig *runnerPb.RunConfig) *Session {
	return &Session{
		SessionID:  uuid.NewString(),
		WorkerType: workers.WorkerTypeRunner,
		McpClient:  client,

		activeConnection: nil,
		runConfig:        runConfig,
		workerManager:    workerManager,
	}
}

func (s *Session) Stop() error {
	return s.closeActiveConnection()
}

func (s *Session) AcceptMessage(message *mcp.MCPMessage) error {
	s.ensureConnection()

	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return s.activeConnection.AcceptMessage(message)
}

func (s *Session) Messages() <-chan mcp.MCPMessage {
	s.ensureConnection()

	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return s.activeConnection.Messages()
}

func (s *Session) Output() <-chan *mcpPb.McpOutput {
	s.ensureConnection()

	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return s.activeConnection.Output()
}

func (s *Session) Errors() <-chan *mcpPb.McpError {
	s.ensureConnection()

	s.mutex.RLock()
	defer s.mutex.RUnlock()

	return s.activeConnection.Errors()
}

func (s *Session) ensureConnection() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.activeConnection != nil {
		return nil // Connection already exists
	}

	connectionInput := &workers.WorkerConnectionInput{
		SessionID:    s.SessionID,
		ConnectionID: uuid.NewString(),

		RunConfig: s.runConfig,
		MCPClient: s.McpClient,
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

func (s *Session) closeActiveConnection() error {
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

func (s *Session) monitorConnection(connection workers.WorkerConnection) {
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
