package worker

import (
	"log"
	"os"
	"sync"
	"time"

	"github.com/metorial/metorial/mcp-engine/pkg/resources"
	"github.com/metorial/metorial/modules/pubsub"
)

type WorkerHealth struct {
	Healthy       bool
	AcceptingJobs bool
}

type WorkerHealthManager struct {
	Health          WorkerHealth
	HealthBroadcast *pubsub.Broadcaster[WorkerHealth]
	mutex           sync.Mutex
}

func newWorkerHealthManager() *WorkerHealthManager {
	res := &WorkerHealthManager{
		Health:          WorkerHealth{Healthy: true, AcceptingJobs: true},
		HealthBroadcast: pubsub.NewBroadcaster[WorkerHealth](),
	}

	go res.routine()

	return res
}

func (m *WorkerHealthManager) SetHealth(healthy, acceptingJobs bool) {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	if m.Health.Healthy == healthy && m.Health.AcceptingJobs == acceptingJobs {
		log.Println("\n== Worker Health UPDATE ==")

		log.Println("Healthy:", healthy)
		log.Println("Accepting Jobs:", acceptingJobs)
	}

	m.Health.Healthy = healthy
	m.Health.AcceptingJobs = acceptingJobs

	m.HealthBroadcast.Publish(m.Health)
}

func (m *WorkerHealthManager) GetHealth() WorkerHealth {
	m.mutex.Lock()
	defer m.mutex.Unlock()

	return m.Health
}

func (m *WorkerHealthManager) routine() {
	if os.Getenv("ENABLE_RESOURCE_CHECK") == "false" {
		log.Println("Resource checks are disabled, skipping health checks.")
		return
	}

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
			log.Printf("Worker usage high, not accepting jobs: CPU OK=%v, Memory OK=%v", cpuOk, memOk)
			m.SetHealth(true, false)
		}
	}
}
