package mongoStore

import (
	"context"
	"fmt"
	"time"

	"github.com/metorial/metorial/modules/util"
	"github.com/metorial/metorial/services/usage/internal/repository"
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

type UsageRecord struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	OwnerID    string             `bson:"ownerId" json:"ownerId"`
	EntityID   string             `bson:"entityId" json:"entityId"`
	EntityType string             `bson:"entityType" json:"entityType"`
	Count      int64              `bson:"count" json:"count"`
	Type       string             `bson:"type" json:"type"`
	Timestamp  time.Time          `bson:"ts" json:"ts"`
}

func (m *MongoStore) GetUsageTimeline(ctx context.Context, opts repository.TimelineOptions) ([]repository.AggregationResult, error) {
	// Adjust time boundaries based on interval
	from, to := repository.AdjustTimeBoundaries(opts.From, opts.To, opts.Interval.Unit)
	intervalMs := repository.CalculateIntervalMs(opts.Interval)

	// Build match stage
	matchStage := bson.M{
		"ts": bson.M{
			"$gte": from,
			"$lt":  to,
		},
		"type": opts.EventType,
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

	cursor, err := m.collection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, fmt.Errorf("failed to execute aggregation: %w", err)
	}
	defer cursor.Close(ctx)

	var results []AggregationResult
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("failed to decode aggregation results: %w", err)
	}

	return aggregationResultsToAggregationResults(results), nil
}

func (m *MongoStore) IngestUsage(ctx context.Context, records []*repository.UsageRecord) error {
	if len(records) == 0 {
		return nil
	}

	mongoRecords := make([]interface{}, 0, len(records))
	for _, record := range records {
		mongoRecords = append(mongoRecords, UsageRecord{
			OwnerID:    record.OwnerID,
			EntityID:   record.EntityID,
			EntityType: record.EntityType,
			Count:      record.Count,
			Type:       record.EventType,
			Timestamp:  record.Timestamp,
		})
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if _, err := m.collection.InsertMany(ctx, mongoRecords); err != nil {
		return fmt.Errorf("failed to insert usage records: %w", err)
	}

	return nil
}

func aggregationResultsToAggregationResults(results []AggregationResult) []repository.AggregationResult {
	return util.Map(results, func(r AggregationResult) repository.AggregationResult {
		return repository.AggregationResult{
			OwnerID:    r.ID.OwnerID,
			EntityID:   r.ID.EntityID,
			EntityType: r.ID.EntityType,
			Timestamp:  r.ID.Timestamp,
			Count:      r.Count,
		}
	})
}
