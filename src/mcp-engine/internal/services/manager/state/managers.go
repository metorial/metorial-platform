package state

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	clientv3 "go.etcd.io/etcd/client/v3"
)

type Manager struct {
	ID         string `json:"id"`
	LastPingAt int64  `json:"lastPingAt"`
	JoinedAt   int64  `json:"joinedAt"`
	Address    string `json:"address"`
}

func (sm *StateManager) CreateManager(id, address string) error {
	now := time.Now().UnixMilli()
	manager := Manager{
		ID:         id,
		LastPingAt: now,
		JoinedAt:   now,
		Address:    address,
	}

	data, err := json.Marshal(manager)
	if err != nil {
		return fmt.Errorf("failed to marshal manager: %v", err)
	}

	key := fmt.Sprintf("/managers/%s", id)
	_, err = sm.client.Put(sm.ctx, key, string(data))
	if err != nil {
		return fmt.Errorf("failed to create manager: %v", err)
	}

	log.Printf("Created manager %s at %s", id, address)
	return nil
}

func (sm *StateManager) GetManager(id string) (*Manager, error) {
	key := fmt.Sprintf("/managers/%s", id)
	resp, err := sm.client.Get(sm.ctx, key)
	if err != nil {
		return nil, fmt.Errorf("failed to get manager: %v", err)
	}

	if len(resp.Kvs) == 0 {
		return nil, fmt.Errorf("manager not found")
	}

	var manager Manager
	if err := json.Unmarshal(resp.Kvs[0].Value, &manager); err != nil {
		return nil, fmt.Errorf("failed to unmarshal manager: %v", err)
	}

	return &manager, nil
}

func (sm *StateManager) ListManagers() ([]Manager, error) {
	resp, err := sm.client.Get(sm.ctx, "/managers/", clientv3.WithPrefix())
	if err != nil {
		return nil, fmt.Errorf("failed to list managers: %v", err)
	}

	var managers []Manager
	for _, kv := range resp.Kvs {
		var manager Manager
		if err := json.Unmarshal(kv.Value, &manager); err != nil {
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
	_, err = sm.client.Put(sm.ctx, key, string(data))
	if err != nil {
		return fmt.Errorf("failed to update manager: %v", err)
	}

	return nil
}

func (sm *StateManager) deleteManagerWithContext(ctx context.Context, id string) error {
	key := fmt.Sprintf("/managers/%s", id)
	_, err := sm.client.Delete(ctx, key)
	if err != nil {
		return fmt.Errorf("failed to delete manager: %v", err)
	}

	log.Printf("Deleted manager %s", id)
	return nil
}

func (sm *StateManager) DeleteManager(id string) error {
	return sm.deleteManagerWithContext(sm.ctx, id)
}
