package repository

import "context"

type UsageStore interface {
	IngestUsage(ctx context.Context, records []*UsageRecord) error
	GetUsageTimeline(ctx context.Context, opts TimelineOptions) ([]AggregationResult, error)
}
