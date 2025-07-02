package mcp_runner

import (
	"log"
	"sync"
	"time"

	"github.com/metorial/metorial/mcp-engine/pkg/resources"
)

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
	res := &RunnerHealthManager{
		Health:     RunnerHealth{healthy: true, acceptingRuns: true},
		HealthChan: make(chan RunnerHealth, 1),
	}

	go res.routine()

	return res
}

func (m *RunnerHealthManager) SetHealth(healthy, acceptingRuns bool) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.Health.healthy == healthy && m.Health.acceptingRuns == acceptingRuns {
		// No change in health status, skip update
		return
	}

	m.Health.healthy = healthy
	m.Health.acceptingRuns = acceptingRuns

	select {
	case m.HealthChan <- m.Health:
	default:
		// If the channel is full, we skip sending to avoid blocking
	}
}

func (m *RunnerHealthManager) GetHealth() RunnerHealth {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	return m.Health
}

func (m *RunnerHealthManager) routine() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		cpuOk, err := resources.CheckCPUUsage(85.0)
		if err != nil {
			m.SetHealth(false, false)
			continue
		}

		memOk, err := resources.CheckMemoryUsage(500)
		if err != nil {
			m.SetHealth(false, false)
			continue
		}

		if cpuOk && memOk {
			m.SetHealth(true, true)
		} else {
			log.Printf("Runner usage high, not accepting jobs: CPU OK=%v, Memory OK=%v", cpuOk, memOk)
			m.SetHealth(true, false)
		}
	}
}
