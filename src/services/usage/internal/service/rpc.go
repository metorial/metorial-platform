package service

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/metorial/metorial/services/usage/gen/rpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/metorial/metorial/services/usage/internal/db"
)

type UsageService struct {
	rpc.UnimplementedUsageServiceServer
}

func newUsageService() *UsageService {
	return &UsageService{}
}

func (s *UsageService) IngestUsageRecord(ctx context.Context, req *rpc.IngestUsageRecordRequest) (*rpc.IngestUsageRecordResponse, error) {
	if err := validateIngestRequest(req); err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	record := db.UsageRecord{
		OwnerID:    req.Owner.Id,
		EntityID:   req.Entity.Id,
		EntityType: req.Entity.Type,
		Type:       req.Type,
		Count:      req.Count,
	}

	// Default count to 1 if not specified
	if record.Count <= 0 {
		record.Count = 1
	}

	db.IngestUsage(record)

	return &rpc.IngestUsageRecordResponse{}, nil
}

func (s *UsageService) GetUsageTimeline(ctx context.Context, req *rpc.GetUsageTimelineRequest) (*rpc.GetUsageTimelineResponse, error) {
	if err := validateTimelineRequest(req); err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	opts := db.TimelineOptions{
		EntityIDs:   req.EntityIds,
		EntityTypes: req.EntityTypes,
		From:        time.Unix(req.From, 0),
		To:          time.Unix(req.To, 0),
		Interval: db.IntervalConfig{
			Unit:  convertIntervalUnit(req.Interval.Unit),
			Count: req.Interval.Count,
		},
	}

	for _, owner := range req.Owners {
		opts.OwnerIDs = append(opts.OwnerIDs, owner.Id)
	}

	timeline, err := db.GetUsageTimeline(ctx, opts)
	if err != nil {
		log.Printf("Failed to get usage timeline: %v", err)
		return nil, status.Error(codes.Internal, "failed to retrieve usage timeline")
	}

	response := &rpc.GetUsageTimelineResponse{
		Series: make([]*rpc.TimelineSeries, len(timeline)),
	}

	for i, series := range timeline {
		grpcSeries := &rpc.TimelineSeries{
			EntityId:   series.EntityID,
			EntityType: series.EntityType,
			OwnerId:    series.OwnerID,
			Entries:    make([]*rpc.TimelineEntry, len(series.Entries)),
		}

		for j, entry := range series.Entries {
			grpcSeries.Entries[j] = &rpc.TimelineEntry{
				Ts:    entry.Timestamp.Unix(),
				Count: entry.Count,
			}
		}

		response.Series[i] = grpcSeries
	}

	return response, nil
}

func RegisterServer(server *grpc.Server, service *UsageService) {
	rpc.RegisterUsageServiceServer(server, service)
}

func validateIngestRequest(req *rpc.IngestUsageRecordRequest) error {
	if req.Owner == nil {
		return fmt.Errorf("owner is required")
	}
	if req.Owner.Id == "" {
		return fmt.Errorf("owner ID is required")
	}
	if req.Owner.Type == rpc.OwnerType_owner_type_unspecified {
		return fmt.Errorf("owner type must be specified")
	}

	if req.Entity == nil {
		return fmt.Errorf("entity is required")
	}
	if req.Entity.Id == "" {
		return fmt.Errorf("entity ID is required")
	}
	if req.Entity.Type == "" {
		return fmt.Errorf("entity type is required")
	}

	if req.Type == "" {
		return fmt.Errorf("usage type is required")
	}

	if req.Count < 0 {
		return fmt.Errorf("count cannot be negative")
	}

	return nil
}

func validateTimelineRequest(req *rpc.GetUsageTimelineRequest) error {
	if req.From <= 0 {
		return fmt.Errorf("from timestamp is required")
	}
	if req.To <= 0 {
		return fmt.Errorf("to timestamp is required")
	}
	if req.From >= req.To {
		return fmt.Errorf("from timestamp must be before to timestamp")
	}

	if req.Interval == nil {
		return fmt.Errorf("interval is required")
	}
	if req.Interval.Unit == rpc.IntervalUnit_interval_unit_unspecified {
		return fmt.Errorf("interval unit must be specified")
	}
	if req.Interval.Count <= 0 {
		return fmt.Errorf("interval count must be positive")
	}

	return nil
}

func convertIntervalUnit(unit rpc.IntervalUnit) db.IntervalConfigUnit {
	switch unit {
	case rpc.IntervalUnit_interval_unit_hour:
		return db.IntervalUnitHour
	case rpc.IntervalUnit_interval_unit_minute:
		return db.IntervalUnitMinute
	case rpc.IntervalUnit_interval_unit_day:
		return db.IntervalUnitDay
	default:
		return db.IntervalUnitHour // Default to hour if unspecified
	}
}
