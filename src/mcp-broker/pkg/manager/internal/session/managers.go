package session

import (
	"sync"

	managerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/manager"
	"github.com/metorial/metorial/mcp-broker/pkg/manager/internal/state"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type OtherManagers struct {
	state *state.StateManager

	mutex                 sync.RWMutex
	createConnectionMutex sync.Mutex

	managers           map[string]*state.Manager
	managerConnections map[string]managerPb.McpManagerClient
}

func NewOtherManagers(inputState *state.StateManager) *OtherManagers {
	return &OtherManagers{
		managers: make(map[string]*state.Manager),
		state:    inputState,
	}
}

func (om *OtherManagers) GetManager(managerID string) (*state.Manager, error) {
	om.mutex.RLock()

	manager, exists := om.managers[managerID]
	if !exists {
		om.mutex.RUnlock()

		// It's fine to lock the state manager here, as we only have
		// a few managers
		om.mutex.Lock()
		defer om.mutex.Unlock()

		manager, err := om.state.GetManager(managerID)
		if err != nil {
			return nil, err
		}

		om.managers[managerID] = manager

		return manager, nil
	}

	om.mutex.RUnlock()
	return manager, nil
}

func (om *OtherManagers) GetManagerConnection(managerID string) (managerPb.McpManagerClient, error) {
	manager, err := om.GetManager(managerID)
	if err != nil {
		return nil, err
	}

	om.mutex.RLock()
	connection, exists := om.managerConnections[manager.ID]
	om.mutex.RUnlock()
	if exists {
		return connection, nil
	}

	om.createConnectionMutex.Lock()
	defer om.createConnectionMutex.Unlock()

	// Double-check if the connection was created while we were waiting for the lock
	connection, exists = om.managerConnections[manager.ID]
	if exists {
		return connection, nil
	}

	conn, err := grpc.NewClient(manager.Address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	client := managerPb.NewMcpManagerClient(conn)
	om.mutex.Lock()
	defer om.mutex.Unlock()
	om.managerConnections[manager.ID] = client

	return client, nil
}
