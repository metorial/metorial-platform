package state

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	clientv3 "go.etcd.io/etcd/client/v3"
)

type Connection struct {
	ID         string `json:"id"`
	Running    bool   `json:"running"`
	ManagerID  string `json:"managerId"`
	WorkerID   string `json:"workerId"`
	LastPingAt int64  `json:"lastPingAt"`
	CreatedAt  int64  `json:"createdAt"`
}

func (sm *StateManager) CreateConnection(managerID, workerID string) (*Connection, error) {
	now := time.Now().UnixMilli()
	connection := Connection{
		ID:         uuid.NewString(),
		ManagerID:  managerID,
		WorkerID:   workerID,
		LastPingAt: now,
		CreatedAt:  now,
	}

	data, err := json.Marshal(connection)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal connection: %v", err)
	}

	key := fmt.Sprintf("/connections/%s", connection.ID)
	_, err = sm.client.Put(sm.ctx, key, string(data))
	if err != nil {
		return nil, fmt.Errorf("failed to create connection: %v", err)
	}

	log.Printf("Created connection %s (broker: %s, worker: %s)", connection.ID, managerID, workerID)
	return &connection, nil
}

func (sm *StateManager) GetConnection(id string) (*Connection, error) {
	key := fmt.Sprintf("/connections/%s", id)
	resp, err := sm.client.Get(sm.ctx, key)
	if err != nil {
		return nil, fmt.Errorf("failed to get connection: %v", err)
	}

	if len(resp.Kvs) == 0 {
		return nil, fmt.Errorf("connection not found")
	}

	var connection Connection
	if err := json.Unmarshal(resp.Kvs[0].Value, &connection); err != nil {
		return nil, fmt.Errorf("failed to unmarshal connection: %v", err)
	}

	return &connection, nil
}

func (sm *StateManager) ListConnections() ([]Connection, error) {
	resp, err := sm.client.Get(sm.ctx, "/connections/", clientv3.WithPrefix())
	if err != nil {
		return nil, fmt.Errorf("failed to list connections: %v", err)
	}

	var connections []Connection
	for _, kv := range resp.Kvs {
		var connection Connection
		if err := json.Unmarshal(kv.Value, &connection); err != nil {
			log.Printf("Failed to unmarshal connection data: %v", err)
			continue
		}
		connections = append(connections, connection)
	}

	return connections, nil
}

func (sm *StateManager) ListConnectionsByWorker(workerID string) ([]Connection, error) {
	connections, err := sm.ListConnections()
	if err != nil {
		return nil, err
	}

	var filtered []Connection
	for _, conn := range connections {
		if conn.WorkerID == workerID {
			filtered = append(filtered, conn)
		}
	}

	return filtered, nil
}

func (sm *StateManager) UpdateConnection(connection *Connection) error {
	data, err := json.Marshal(connection)
	if err != nil {
		return fmt.Errorf("failed to marshal connection: %v", err)
	}

	key := fmt.Sprintf("/connections/%s", connection.ID)
	_, err = sm.client.Put(sm.ctx, key, string(data))
	if err != nil {
		return fmt.Errorf("failed to update connection: %v", err)
	}

	return nil
}

func (sm *StateManager) DeleteConnection(id string) error {
	key := fmt.Sprintf("/connections/%s", id)
	_, err := sm.client.Delete(sm.ctx, key)
	if err != nil {
		return fmt.Errorf("failed to delete connection: %v", err)
	}

	log.Printf("Deleted connection %s", id)
	return nil
}
