package db

import "time"

func adjustTimeBoundaries(from, to time.Time, unit IntervalConfigUnit) (time.Time, time.Time) {
	switch unit {
	case IntervalUnitDay:
		from = time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, from.Location())
		to = time.Date(to.Year(), to.Month(), to.Day(), 23, 59, 59, 999999999, to.Location())
	case IntervalUnitHour:
		from = time.Date(from.Year(), from.Month(), from.Day(), from.Hour(), 0, 0, 0, from.Location())
		to = time.Date(to.Year(), to.Month(), to.Day(), to.Hour(), 59, 59, 999999999, to.Location())
	case IntervalUnitMinute:
		from = time.Date(from.Year(), from.Month(), from.Day(), from.Hour(), from.Minute(), 0, 0, from.Location())
		to = time.Date(to.Year(), to.Month(), to.Day(), to.Hour(), to.Minute(), 59, 999999999, to.Location())
	}

	return from, to
}

func calculateIntervalMs(interval IntervalConfig) int64 {
	baseMs := int64(60 * 60 * 1000) // 1 hour in ms
	if interval.Unit == "day" {
		baseMs = 24 * 60 * 60 * 1000 // 1 day in ms
	}
	return baseMs * int64(interval.Count)
}
