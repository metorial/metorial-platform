package db

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AggregationResult struct {
	ID struct {
		OwnerID    string    `bson:"ownerId"`
		EntityID   string    `bson:"entityId"`
		EntityType string    `bson:"entityType"`
		Type       string    `bson:"type"`
		Timestamp  time.Time `bson:"ts"`
	} `bson:"_id"`
	Count int64 `bson:"count"`
}

func GetUsageTimeline(ctx context.Context, opts TimelineOptions) ([]TimelineSeries, error) {
	if !IsEnabled() {
		return createEmptyTimeline(opts), nil
	}

	// Adjust time boundaries based on interval
	from, to := adjustTimeBoundaries(opts.From, opts.To, opts.Interval.Unit)
	intervalMs := calculateIntervalMs(opts.Interval)

	// Build match stage
	matchStage := bson.M{
		"ts": bson.M{
			"$gte": from,
			"$lt":  to,
		},
	}

	if len(opts.OwnerIDs) > 0 {
		matchStage["ownerId"] = bson.M{"$in": opts.OwnerIDs}
	}
	if len(opts.EntityTypes) > 0 {
		matchStage["entityType"] = bson.M{"$in": opts.EntityTypes}
	}
	if len(opts.EntityIDs) > 0 {
		matchStage["entityId"] = bson.M{"$in": opts.EntityIDs}
	}

	// Build group stage
	groupStage := bson.M{
		"_id": bson.M{
			"ownerId":    "$ownerId",
			"entityId":   "$entityId",
			"entityType": "$entityType",
			"type":       "$type",
			"ts": bson.M{
				"$add": []interface{}{
					bson.M{
						"$subtract": []interface{}{
							bson.M{
								"$subtract": []interface{}{"$ts", primitive.NewDateTimeFromTime(time.Unix(0, 0))},
							},
							bson.M{
								"$mod": []interface{}{
									bson.M{
										"$subtract": []interface{}{"$ts", primitive.NewDateTimeFromTime(time.Unix(0, 0))},
									},
									intervalMs,
								},
							},
						},
					},
					primitive.NewDateTimeFromTime(time.Unix(0, 0)),
				},
			},
		},
		"count": bson.M{"$sum": "$count"},
	}

	// Execute aggregation pipeline
	pipeline := []bson.M{
		{"$match": matchStage},
		{"$group": groupStage},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to execute aggregation: %w", err)
	}
	defer cursor.Close(ctx)

	var results []AggregationResult
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("failed to decode aggregation results: %w", err)
	}

	return buildTimeline(results, opts, from, to, intervalMs), nil
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
		key := fmt.Sprintf("%s:%s:%s", result.ID.OwnerID, result.ID.EntityID, result.ID.EntityType)

		series, exists := timelineMap[key]
		if !exists {
			series = &TimelineSeries{
				OwnerID:    result.ID.OwnerID,
				EntityID:   result.ID.EntityID,
				EntityType: result.ID.EntityType,
				Entries:    []TimelineEntry{},
			}
			timelineMap[key] = series
		}

		series.Entries = append(series.Entries, TimelineEntry{
			Timestamp: result.ID.Timestamp,
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
