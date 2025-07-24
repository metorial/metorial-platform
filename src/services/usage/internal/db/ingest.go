package db

import (
	"fmt"
	"time"
)

func IngestUsage(record UsageRecord) {
	if !IsEnabled() {
		return
	}

	hash := fmt.Sprintf("%s:%s:%s", record.OwnerID, record.EntityID, record.Type)

	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	if existing, ok := usageCache[hash]; ok {
		existing.Count += record.Count
	} else {
		record.Timestamp = time.Now()
		usageCache[hash] = &record
	}
}
