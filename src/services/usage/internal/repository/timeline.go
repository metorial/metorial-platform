package repository

import (
	"context"
	"fmt"
	"time"
)

type AggregationResult struct {
	OwnerID    string
	EntityID   string
	EntityType string
	Timestamp  time.Time
	Count      int64
}

type TimelineOptions struct {
	EventType   string
	OwnerIDs    []string
	EntityTypes []string
	EntityIDs   []string
	From        time.Time
	To          time.Time
	Interval    IntervalConfig
}

type TimelineEntry struct {
	Timestamp time.Time `json:"ts"`
	Count     int64     `json:"count"`
}

type TimelineSeries struct {
	EntityID   string          `json:"entityId"`
	EntityType string          `json:"entityType"`
	OwnerID    string          `json:"ownerId"`
	Entries    []TimelineEntry `json:"entries"`
}

func (r *Repository) GetUsageTimeline(ctx context.Context, opts TimelineOptions) ([]TimelineSeries, error) {
	result, err := r.store.GetUsageTimeline(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to get usage timeline: %w", err)
	}

	from, to := AdjustTimeBoundaries(opts.From, opts.To, opts.Interval.Unit)
	intervalMs := CalculateIntervalMs(opts.Interval)
	timeline := buildTimeline(result, opts, from, to, intervalMs)

	return timeline, nil
}

func buildTimeline(results []AggregationResult, opts TimelineOptions, from, to time.Time, intervalMs int64) []TimelineSeries {
	timelineMap := make(map[string]*TimelineSeries)

	// Initialize with empty series for requested entity IDs if no results
	if len(results) == 0 && len(opts.EntityIDs) > 0 {
		entityType := "any"
		if len(opts.EntityTypes) > 0 {
			entityType = opts.EntityTypes[0]
		}

		for _, entityID := range opts.EntityIDs {
			key := fmt.Sprintf("none:%s:%s", entityID, entityType)
			timelineMap[key] = &TimelineSeries{
				OwnerID:    "none",
				EntityID:   entityID,
				EntityType: entityType,
				Entries:    []TimelineEntry{},
			}
		}
	}

	// Process aggregation results
	for _, result := range results {
		key := fmt.Sprintf("%s:%s:%s", result.OwnerID, result.EntityID, result.EntityType)

		series, exists := timelineMap[key]
		if !exists {
			series = &TimelineSeries{
				OwnerID:    result.OwnerID,
				EntityID:   result.EntityID,
				EntityType: result.EntityType,
				Entries:    []TimelineEntry{},
			}
			timelineMap[key] = series
		}

		series.Entries = append(series.Entries, TimelineEntry{
			Timestamp: result.Timestamp,
			Count:     result.Count,
		})
	}

	fillMissingIntervals(timelineMap, from, to, intervalMs)

	// Convert map to slice and sort entries
	timeline := make([]TimelineSeries, 0, len(timelineMap))
	for _, series := range timelineMap {
		sortTimelineEntries(series.Entries)
		timeline = append(timeline, *series)
	}

	return timeline
}

func createEmptyTimeline(opts TimelineOptions) []TimelineSeries {
	if len(opts.EntityIDs) == 0 {
		return []TimelineSeries{}
	}

	entityType := "any"
	if len(opts.EntityTypes) > 0 {
		entityType = opts.EntityTypes[0]
	}

	timeline := make([]TimelineSeries, 0, len(opts.EntityIDs))
	for _, entityID := range opts.EntityIDs {
		timeline = append(timeline, TimelineSeries{
			OwnerID:    "none",
			EntityID:   entityID,
			EntityType: entityType,
			Entries:    []TimelineEntry{},
		})
	}
	return timeline
}

func fillMissingIntervals(timelineMap map[string]*TimelineSeries, from, to time.Time, intervalMs int64) {
	var timestamps []time.Time
	currentTs := from.UnixMilli()
	toMs := to.UnixMilli()

	for currentTs < toMs {
		timestamps = append(timestamps, time.UnixMilli(currentTs))
		currentTs += intervalMs
	}

	// Fill missing intervals for each series
	for _, series := range timelineMap {
		existingTimes := make(map[int64]bool)
		for _, entry := range series.Entries {
			existingTimes[entry.Timestamp.UnixMilli()] = true
		}

		for _, ts := range timestamps {
			if !existingTimes[ts.UnixMilli()] {
				series.Entries = append(series.Entries, TimelineEntry{
					Timestamp: ts,
					Count:     0,
				})
			}
		}
	}
}

func sortTimelineEntries(entries []TimelineEntry) {
	// Simple bubble sort for timeline entries
	n := len(entries)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if entries[j].Timestamp.After(entries[j+1].Timestamp) {
				entries[j], entries[j+1] = entries[j+1], entries[j]
			}
		}
	}
}
