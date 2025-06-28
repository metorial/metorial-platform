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

	connections, err := sm.ListConnections()
	if err != nil {
		log.Printf("Failed to get connections: %v", err)
		return
	}

	log.Printf("=== System Status ===")
	log.Printf("Managers: %d, Connections: %d",
		len(managers), len(connections))

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

	log.Printf("--- Connections ---")
	for _, conn := range connections {
		lastPing := time.UnixMilli(conn.LastPingAt)
		created := time.UnixMilli(conn.CreatedAt)
		log.Printf("  %s - Manager: %s, Worker: %s, Created: %s, Last Ping: %s",
			conn.ID[:8], conn.ManagerID[:8], conn.WorkerID[:8],
			created.Format("15:04:05"), lastPing.Format("15:04:05"))
	}

	log.Printf("====================")
}
