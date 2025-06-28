package state

import (
	"fmt"
	"log"
	"time"
)

const CONNECTION_MAX_AGE = 1000 * 60 * 30
const MANAGER_DEAD_TIMEOUT = 1000 * 15

func (sm *StateManager) startPingRoutine() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-sm.ctx.Done():
			log.Println("Ping routine stopped")
			return
		case <-ticker.C:
			if err := sm.updateManagerPing(); err != nil {
				log.Printf("Failed to update manager ping: %v", err)
			}
		}
	}
}

func (sm *StateManager) updateManagerPing() error {
	manager, err := sm.GetManager(sm.ManagerID)
	if err != nil {
		return fmt.Errorf("failed to get manager for ping update: %v", err)
	}

	manager.LastPingAt = time.Now().UnixMilli()

	if err := sm.UpdateManager(manager); err != nil {
		return fmt.Errorf("failed to update manager ping: %v", err)
	}

	return nil
}

func (sm *StateManager) startCleanupRoutine() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-sm.ctx.Done():
			log.Println("Cleanup routine stopped")
			return
		case <-ticker.C:
			if err := sm.cleanupDeadManagers(); err != nil {
				log.Printf("Failed to cleanup dead managers: %v", err)
			}

			if err := sm.cleanupDeadConnections(); err != nil {
				log.Printf("Failed to cleanup dead connections: %v", err)
			}
		}
	}
}

func (sm *StateManager) cleanupDeadManagers() error {
	managers, err := sm.ListManagers()
	if err != nil {
		return fmt.Errorf("failed to get managers for cleanup: %v", err)
	}

	cutoffTime := time.Now().UnixMilli() - MANAGER_DEAD_TIMEOUT
	deadManagers := []string{}

	for _, manager := range managers {
		if manager.LastPingAt < cutoffTime {
			deadManagers = append(deadManagers, manager.ID)
		}
	}

	// Remove dead managers
	for _, managerID := range deadManagers {
		if err := sm.DeleteManager(managerID); err != nil {
			log.Printf("Failed to delete dead manager %s: %v", managerID, err)
		} else {
			log.Printf("Removed dead manager %s", managerID)
		}
	}

	if len(deadManagers) > 0 {
		log.Printf("Cleaned up %d dead managers", len(deadManagers))
	}

	return nil
}

func (sm *StateManager) cleanupDeadConnections() error {
	connections, err := sm.ListConnections()
	if err != nil {
		return fmt.Errorf("failed to get connections for cleanup: %v", err)
	}

	cutoffTime := time.Now().UnixMilli() - CONNECTION_MAX_AGE
	deadConnections := []string{}

	for _, connection := range connections {
		if connection.LastPingAt < cutoffTime {
			deadConnections = append(deadConnections, connection.ID)
		}
	}

	// Remove dead connections
	for _, connectionID := range deadConnections {
		if err := sm.DeleteConnection(connectionID); err != nil {
			log.Printf("Failed to delete dead connection %s: %v", connectionID, err)
		} else {
			log.Printf("Removed dead connection %s", connectionID)
		}
	}

	if len(deadConnections) > 0 {
		log.Printf("Cleaned up %d dead connections", len(deadConnections))
	}

	return nil
}
