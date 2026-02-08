package state

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/metorial/metorial/modules/util"
)

type StateManager struct {
	ManagerID string

	ManagerAddress      string
	WorkerBrokerAddress string

	backend StorageBackend

	ctx    context.Context
	cancel context.CancelFunc
}

func NewStateManager(config Config, managerAddress, workerBrokerAddress string) (*StateManager, error) {
	var backend StorageBackend
	var err error

	switch config.BackendType {
	case BackendEtcd:
		backend, err = NewEtcdBackend(config)
	case BackendRedis:
		backend, err = NewRedisBackend(config)
	default:
		return nil, fmt.Errorf("unsupported backend type: %s", config.BackendType)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create backend: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &StateManager{
		backend:             backend,
		ManagerID:           util.Must(uuid.NewV7()).String(),
		ManagerAddress:      managerAddress,
		WorkerBrokerAddress: workerBrokerAddress,
		ctx:                 ctx,
		cancel:              cancel,
	}, nil
}

func (sm *StateManager) Start() error {
	log.Printf("Starting state manager with ID: %s", sm.ManagerID)

	if err := sm.CreateManager(sm.ManagerID, sm.ManagerAddress, sm.WorkerBrokerAddress); err != nil {
		return fmt.Errorf("failed to register manager: %v", err)
	}

	go sm.startPingRoutine()
	go sm.startCleanupRoutine()

	return nil
}

func (sm *StateManager) Stop() error {
	log.Printf("Stopping state manager with ID: %s", sm.ManagerID)

	sm.cancel()

	time.Sleep(100 * time.Millisecond)

	cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cleanupCancel()

	if err := sm.deleteManagerWithContext(cleanupCtx, sm.ManagerID); err != nil {
		log.Printf("Failed to unregister manager: %v", err)
	}

	return sm.backend.Close()
}

func (sm *StateManager) Done() <-chan struct{} {
	return sm.ctx.Done()
}

// Manager operations
func (sm *StateManager) CreateManager(id, managerAddress, workerBrokerAddress string) error {
	now := time.Now().UnixMilli()
	manager := Manager{
		ID:         id,
		LastPingAt: now,
		JoinedAt:   now,

		ManagerAddress:      managerAddress,
		WorkerBrokerAddress: workerBrokerAddress,
	}

	data, err := json.Marshal(manager)
	if err != nil {
		return fmt.Errorf("failed to marshal manager: %v", err)
	}

	key := fmt.Sprintf("/managers/%s", id)
	if err := sm.backend.Put(sm.ctx, key, string(data)); err != nil {
		return fmt.Errorf("failed to create manager: %v", err)
	}

	log.Printf("Created manager %s at %s", id, managerAddress)
	if workerBrokerAddress != managerAddress {
		log.Printf("Worker broker address: %s", workerBrokerAddress)
	}

	return nil
}

func (sm *StateManager) GetManager(id string) (*Manager, error) {
	key := fmt.Sprintf("/managers/%s", id)
	value, err := sm.backend.Get(sm.ctx, key)
	if err != nil {
		return nil, fmt.Errorf("failed to get manager: %v", err)
	}
	if value == "" {
		return nil, fmt.Errorf("manager not found")
	}

	var manager Manager
	if err := json.Unmarshal([]byte(value), &manager); err != nil {
		return nil, fmt.Errorf("failed to unmarshal manager: %v", err)
	}

	return &manager, nil
}

func (sm *StateManager) ListManagers() ([]Manager, error) {
	data, err := sm.backend.List(sm.ctx, "/managers/")
	if err != nil {
		return nil, fmt.Errorf("failed to list managers: %v", err)
	}

	var managers []Manager
	for _, value := range data {
		var manager Manager
		if err := json.Unmarshal([]byte(value), &manager); err != nil {
			log.Printf("Failed to unmarshal manager data: %v", err)
			continue
		}
		managers = append(managers, manager)
	}

	return managers, nil
}

func (sm *StateManager) UpdateManager(manager *Manager) error {
	data, err := json.Marshal(manager)
	if err != nil {
		return fmt.Errorf("failed to marshal manager: %v", err)
	}

	key := fmt.Sprintf("/managers/%s", manager.ID)
	if err := sm.backend.Put(sm.ctx, key, string(data)); err != nil {
		return fmt.Errorf("failed to update manager: %v", err)
	}

	return nil
}

func (sm *StateManager) deleteManagerWithContext(ctx context.Context, id string) error {
	key := fmt.Sprintf("/managers/%s", id)
	if err := sm.backend.Delete(ctx, key); err != nil {
		return fmt.Errorf("failed to delete manager: %v", err)
	}

	log.Printf("Deleted manager %s", id)
	return nil
}

func (sm *StateManager) DeleteManager(id string) error {
	return sm.deleteManagerWithContext(sm.ctx, id)
}

// Session operations
func (sm *StateManager) UpsertSession(sessionID string, managerID string, sessionUuid string) (*Session, error) {
	key := fmt.Sprintf("/sessions/%s", sessionID)

	return sm.withSessionLock(key, func() (*Session, error) {
		// Check if session exists
		value, err := sm.backend.Get(sm.ctx, key)
		if err == nil && value != "" {
			var existing Session
			if err := json.Unmarshal([]byte(value), &existing); err != nil {
				return nil, fmt.Errorf("failed to unmarshal existing session: %v", err)
			}
			return &existing, nil
		}

		// If not exists, create new session
		now := time.Now().UnixMilli()
		session := Session{
			ID:          sessionID,
			ManagerID:   managerID,
			LastPingAt:  now,
			CreatedAt:   now,
			SessionUuid: sessionUuid,
		}

		data, err := json.Marshal(session)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal session: %v", err)
		}

		if err := sm.backend.Put(sm.ctx, key, string(data)); err != nil {
			return nil, fmt.Errorf("failed to store session: %v", err)
		}

		log.Printf("Created new session %s (manager: %s)", session.ID, managerID)
		return &session, nil
	})
}

func (sm *StateManager) GetSession(id string) (*Session, error) {
	key := fmt.Sprintf("/sessions/%s", id)
	value, err := sm.backend.Get(sm.ctx, key)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %v", err)
	}

	if value == "" {
		return nil, fmt.Errorf("session not found")
	}

	var session Session
	if err := json.Unmarshal([]byte(value), &session); err != nil {
		return nil, fmt.Errorf("failed to unmarshal session: %v", err)
	}

	return &session, nil
}

func (sm *StateManager) ListSessions() ([]Session, error) {
	data, err := sm.backend.List(sm.ctx, "/sessions/")
	if err != nil {
		return nil, fmt.Errorf("failed to list sessions: %v", err)
	}

	var sessions []Session
	for _, value := range data {
		var session Session
		if err := json.Unmarshal([]byte(value), &session); err != nil {
			log.Printf("Failed to unmarshal session data: %v", err)
			continue
		}
		sessions = append(sessions, session)
	}

	return sessions, nil
}

func (sm *StateManager) ListSessionsByManager(managerID string) ([]Session, error) {
	sessions, err := sm.ListSessions()
	if err != nil {
		return nil, err
	}

	var filtered []Session
	for _, conn := range sessions {
		if conn.ManagerID == managerID {
			filtered = append(filtered, conn)
		}
	}

	return filtered, nil
}

func (sm *StateManager) UpdateSession(session *Session) error {
	data, err := json.Marshal(session)
	if err != nil {
		return fmt.Errorf("failed to marshal session: %v", err)
	}

	key := fmt.Sprintf("/sessions/%s", session.ID)
	if err := sm.backend.Put(sm.ctx, key, string(data)); err != nil {
		return fmt.Errorf("failed to update session: %v", err)
	}

	return nil
}

func (sm *StateManager) DeleteSession(id string) (*Session, error) {
	key := fmt.Sprintf("/sessions/%s", id)

	return sm.withSessionLock(key, func() (*Session, error) {
		if err := sm.backend.Delete(sm.ctx, key); err != nil {
			return nil, fmt.Errorf("failed to delete session: %v", err)
		}

		log.Printf("Deleted session %s", id)
		return nil, nil
	})
}

func (sm *StateManager) withSessionLock(key string, fn func() (*Session, error)) (*Session, error) {
	lock, err := sm.backend.Lock(sm.ctx, key)
	if err != nil {
		return nil, fmt.Errorf("failed to acquire lock: %v", err)
	}
	defer func() {
		if err := lock.Unlock(sm.ctx); err != nil {
			log.Printf("failed to release lock for key %s: %v", key, err)
		}
	}()

	return fn()
}
