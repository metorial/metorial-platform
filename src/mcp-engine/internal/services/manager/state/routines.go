package state

import (
	"fmt"
	"log"
	"time"
)

const SESSION_DEAD_TIMEOUT = 1000 * 60
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

			if err := sm.cleanupDeadSessions(); err != nil {
				log.Printf("Failed to cleanup dead sessions: %v", err)
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

func (sm *StateManager) cleanupDeadSessions() error {
	sessions, err := sm.ListSessions()
	if err != nil {
		return fmt.Errorf("failed to get sessions for cleanup: %v", err)
	}

	cutoffTime := time.Now().UnixMilli() - SESSION_DEAD_TIMEOUT
	deadSessions := []string{}

	for _, session := range sessions {
		if session.LastPingAt < cutoffTime {
			deadSessions = append(deadSessions, session.ID)
		}
	}

	// Remove dead sessions
	for _, sessionID := range deadSessions {
		if _, err := sm.DeleteSession(sessionID); err != nil {
			log.Printf("Failed to delete dead session %s: %v", sessionID, err)
		} else {
			log.Printf("Removed dead session %s", sessionID)
		}
	}

	if len(deadSessions) > 0 {
		log.Printf("Cleaned up %d dead sessions", len(deadSessions))
	}

	return nil
}
