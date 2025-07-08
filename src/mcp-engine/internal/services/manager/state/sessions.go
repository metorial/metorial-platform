package state

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	clientv3 "go.etcd.io/etcd/client/v3"
	"go.etcd.io/etcd/client/v3/concurrency"
)

type Session struct {
	ID          string `json:"id"`
	ManagerID   string `json:"managerId"`
	LastPingAt  int64  `json:"lastPingAt"`
	CreatedAt   int64  `json:"createdAt"`
	SessionUuid string `json:"sessionUuid"` // Optional field for session UUID
}

func (sm *StateManager) UpsertSession(sessionID string, managerID string, sessionUuid string) (*Session, error) {
	key := fmt.Sprintf("/sessions/%s", sessionID)

	return sm.withSessionLock(key, func() (*Session, error) {
		// Check if session exists
		resp, err := sm.client.Get(sm.ctx, key)
		if err != nil {
			return nil, fmt.Errorf("failed to get session: %v", err)
		}
		if len(resp.Kvs) > 0 {
			var existing Session
			if err := json.Unmarshal(resp.Kvs[0].Value, &existing); err != nil {
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

		_, err = sm.client.Put(sm.ctx, key, string(data))
		if err != nil {
			return nil, fmt.Errorf("failed to store session: %v", err)
		}

		log.Printf("Created new session %s (manager: %s)", session.ID, managerID)
		return &session, nil
	})
}

func (sm *StateManager) GetSession(id string) (*Session, error) {
	key := fmt.Sprintf("/sessions/%s", id)
	resp, err := sm.client.Get(sm.ctx, key)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %v", err)
	}

	if len(resp.Kvs) == 0 {
		return nil, fmt.Errorf("session not found")
	}

	var session Session
	if err := json.Unmarshal(resp.Kvs[0].Value, &session); err != nil {
		return nil, fmt.Errorf("failed to unmarshal session: %v", err)
	}

	return &session, nil
}

func (sm *StateManager) ListSessions() ([]Session, error) {
	resp, err := sm.client.Get(sm.ctx, "/sessions/", clientv3.WithPrefix())
	if err != nil {
		return nil, fmt.Errorf("failed to list sessions: %v", err)
	}

	var sessions []Session
	for _, kv := range resp.Kvs {
		var session Session
		if err := json.Unmarshal(kv.Value, &session); err != nil {
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
	_, err = sm.client.Put(sm.ctx, key, string(data))
	if err != nil {
		return fmt.Errorf("failed to update session: %v", err)
	}

	return nil
}

func (sm *StateManager) DeleteSession(id string) (*Session, error) {
	key := fmt.Sprintf("/sessions/%s", id)

	return sm.withSessionLock(key, func() (*Session, error) {
		_, err := sm.client.Delete(sm.ctx, key)
		if err != nil {
			return nil, fmt.Errorf("failed to delete session: %v", err)
		}

		log.Printf("Deleted session %s", id)
		return nil, nil
	})
}

func (sm *StateManager) withSessionLock(key string, fn func() (*Session, error)) (*Session, error) {
	lockKey := fmt.Sprintf("/locks%s", key)

	lockSession, err := concurrency.NewSession(sm.client)
	if err != nil {
		return nil, fmt.Errorf("failed to create etcd session for locking: %v", err)
	}
	defer lockSession.Close()

	mutex := concurrency.NewMutex(lockSession, lockKey)

	if err := mutex.Lock(sm.ctx); err != nil {
		return nil, fmt.Errorf("failed to acquire lock: %v", err)
	}
	defer func() {
		if err := mutex.Unlock(sm.ctx); err != nil {
			log.Printf("failed to release lock for key %s: %v", key, err)
		}
	}()

	return fn()
}
