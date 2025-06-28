package manager

import "github.com/metorial/metorial/mcp-broker/pkg/manager/internal/state"

type Manager struct {
	state *state.StateManager
}

func NewManager(etcdEndpoints []string, address string) (*Manager, error) {
	sm, err := state.NewStateManager(etcdEndpoints, address)
	if err != nil {
		return nil, err
	}

	if err := sm.Start(); err != nil {
		return nil, err
	}

	return &Manager{state: sm}, nil
}

func (m *Manager) Stop() error {
	if m.state == nil {
		return nil
	}

	if err := m.state.Stop(); err != nil {
		return err
	}

	m.state = nil
	return nil
}

func (m *Manager) GetManagerID() string {
	if m.state == nil {
		return ""
	}

	return m.state.ManagerID
}

func (m *Manager) PrintStatus() {
	if m.state == nil {
		return
	}

	state.PrintStatus(m.state)
}
