package mcp_runner

import "sync"

type RunnerHealth struct {
	healthy       bool
	acceptingRuns bool
}

type RunnerHealthManager struct {
	Health     RunnerHealth
	HealthChan chan RunnerHealth
	mutex      sync.Mutex
}

func NewRunnerHealthManager() *RunnerHealthManager {
	return &RunnerHealthManager{
		Health:     RunnerHealth{healthy: true, acceptingRuns: true},
		HealthChan: make(chan RunnerHealth, 1),
	}
}

func (m *RunnerHealthManager) SetHealth(healthy, acceptingRuns bool) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	m.Health.healthy = healthy
	m.Health.acceptingRuns = acceptingRuns

	select {
	case m.HealthChan <- m.Health:
	default:
		// If the channel is full, we skip sending to avoid blocking
	}
}
