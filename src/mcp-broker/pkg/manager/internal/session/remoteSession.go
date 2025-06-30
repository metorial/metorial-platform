package session

import (
	"sync"
	"time"

	managerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/manager"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/state"
)

const REMOTE_SESSION_INACTIVITY_TIMEOUT = 1000 * 60

type RemoteSession struct {
	storedSession             *state.Session
	lastConnectionInteraction time.Time
	mutex                     sync.RWMutex
}

func (s *RemoteSession) SendMcpMessage(request *managerPb.SendMcpMessageRequest) (*managerPb.SendMcpMessageResponse, error) {
	return &managerPb.SendMcpMessageResponse{}, nil
}

func (s *RemoteSession) CanDiscard() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// If the last interaction with the connection was too long ago, we can discard it
	if time.Since(s.lastConnectionInteraction) > LOCAL_SESSION_INACTIVITY_TIMEOUT {
		return true
	}

	return false
}

func (s *RemoteSession) StoredSession() *state.Session {
	return s.storedSession
}

func (s *RemoteSession) stop() error {
	return nil
}
