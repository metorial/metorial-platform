package state

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/metorial/metorial/mcp-engine/pkg/util"
	clientv3 "go.etcd.io/etcd/client/v3"
)

type StateManager struct {
	ManagerID string
	Address   string

	client *clientv3.Client

	ctx    context.Context
	cancel context.CancelFunc
}

func NewStateManager(etcdEndpoints []string, address string) (*StateManager, error) {
	client, err := clientv3.New(clientv3.Config{
		Endpoints:   etcdEndpoints,
		DialTimeout: 5 * time.Second,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create etcd client: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &StateManager{
		client:    client,
		ManagerID: util.Must(uuid.NewV7()).String(),
		Address:   address,
		ctx:       ctx,
		cancel:    cancel,
	}, nil
}

func (sm *StateManager) Start() error {
	log.Printf("Starting state manager with ID: %s", sm.ManagerID)

	if err := sm.CreateManager(sm.ManagerID, sm.Address); err != nil {
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

	return sm.client.Close()
}

func (sm *StateManager) Done() <-chan struct{} {
	return sm.ctx.Done()
}
