package service

import "time"

func (s *ScalableListenerConnectorService) cleanupExpiredMessages() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		s.pendingMu.Lock()
		for messageID, pending := range s.pending {
			if now.Sub(pending.RequestTime) > 35*time.Second {
				pending.CancelFunc()
				delete(s.pending, messageID)
			}
		}
		s.pendingMu.Unlock()
	}
}
