package state

import (
	"log"
	"time"
)

func PrintStatus(sm *StateManager) {
	managers, err := sm.ListManagers()
	if err != nil {
		log.Printf("Failed to get managers: %v", err)
		return
	}

	sessions, err := sm.ListSessions()
	if err != nil {
		log.Printf("Failed to get sessions: %v", err)
		return
	}

	log.Printf("=== System Status ===")
	log.Printf("Managers: %d, Sessions: %d",
		len(managers), len(sessions))

	log.Printf("--- Managers ---")
	for _, manager := range managers {
		lastPing := time.UnixMilli(manager.LastPingAt)
		joined := time.UnixMilli(manager.JoinedAt)
		isSelf := ""
		if manager.ID == sm.ManagerID {
			isSelf = " (self)"
		}
		log.Printf("  %s%s - %s, Joined: %s, Last Ping: %s",
			manager.ID[:8], isSelf, manager.Address,
			joined.Format("15:04:05"), lastPing.Format("15:04:05"))
	}

	log.Printf("--- Sessions ---")
	for _, conn := range sessions {
		lastPing := time.UnixMilli(conn.LastPingAt)
		created := time.UnixMilli(conn.CreatedAt)
		log.Printf("  %s - Manager: %s, Created: %s, Last Ping: %s",
			conn.ID[:8], conn.ManagerID[:8],
			created.Format("15:04:05"), lastPing.Format("15:04:05"))
	}

	log.Printf("====================")
}
