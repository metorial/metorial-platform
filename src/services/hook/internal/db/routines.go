package db

import (
	"fmt"
	"time"

	"github.com/robfig/cron/v3"
)

func (d *DB) deleteOldEventsRoutine() {
	c := cron.New()

	// Add a job to run every minute
	_, err := c.AddFunc("0 * * * *", func() {
		now := time.Now()
		twoWeeksAgo := now.Add(-14 * 24 * time.Hour)

		d.db.
			Where("created_at < ?", twoWeeksAgo).
			Delete(&Event{})
	})
	if err != nil {
		fmt.Println("Error scheduling job:", err)
		return
	}

	c.Start()
}
