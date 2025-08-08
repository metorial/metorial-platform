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

	"github.com/metorial/metorial/services/usage/internal/repository"
)

type UsageService struct {
	rpc.UnimplementedUsageServiceServer

	repository *repository.Repository
}

func newUsageService(repo *repository.Repository) *UsageService {
	return &UsageService{
		repository: repo,
	}
}

func (s *UsageService) IngestUsageRecord(ctx context.Context, req *rpc.IngestUsageRecordRequest) (*rpc.IngestUsageRecordResponse, error) {
	if err := validateIngestRequest(req); err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	for _, record := range req.Records {
		record := repository.UsageRecord{
			OwnerID:    record.Owner.Id,
			EntityID:   record.Entity.Id,
			EntityType: record.Entity.Type,
			EventType:  record.EventType,
			Count:      record.Count,
		}

		// Default count to 1 if not specified
		if record.Count <= 0 {
			record.Count = 1
		}

		s.repository.IngestUsage(record)
	}

	return &rpc.IngestUsageRecordResponse{}, nil
}

func (s *UsageService) GetUsageTimeline(ctx context.Context, req *rpc.GetUsageTimelineRequest) (*rpc.GetUsageTimelineResponse, error) {
	if err := validateTimelineRequest(req); err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	events := make([]*rpc.TimelineEvent, 0, len(req.EventTypes))

	for _, eventType := range req.EventTypes {

		opts := repository.TimelineOptions{
			EventType:   eventType,
			EntityIDs:   req.EntityIds,
			EntityTypes: req.EntityTypes,
			From:        time.Unix(req.From, 0),
			To:          time.Unix(req.To, 0),
			Interval: repository.IntervalConfig{
				Unit:  convertIntervalUnit(req.Interval.Unit),
				Count: req.Interval.Count,
			},
		}

		for _, owner := range req.Owners {
			opts.OwnerIDs = append(opts.OwnerIDs, owner.Id)
		}

		timeline, err := s.repository.GetUsageTimeline(ctx, opts)
		if err != nil {
			log.Printf("Failed to get usage timeline: %v", err)
			return nil, status.Error(codes.Internal, "failed to retrieve usage timeline")
		}

		event := rpc.TimelineEvent{
			EventType: eventType,
			Series:    make([]*rpc.TimelineSeries, len(timeline)),
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

			event.Series[i] = grpcSeries
		}

		events = append(events, &event)
	}

	response := &rpc.GetUsageTimelineResponse{
		Events: events,
	}

	return response, nil
}

func RegisterServer(server *grpc.Server, service *UsageService) {
	rpc.RegisterUsageServiceServer(server, service)
}

func validateIngestRequest(req *rpc.IngestUsageRecordRequest) error {
	for _, record := range req.Records {
		if record.Owner == nil {
			return fmt.Errorf("owner is required")
		}
		if record.Owner.Id == "" {
			return fmt.Errorf("owner ID is required")
		}
		if record.Owner.Type == rpc.OwnerType_owner_type_unspecified {
			return fmt.Errorf("owner type must be specified")
		}

		if record.Entity == nil {
			return fmt.Errorf("entity is required")
		}
		if record.Entity.Id == "" {
			return fmt.Errorf("entity ID is required")
		}
		if record.Entity.Type == "" {
			return fmt.Errorf("entity type is required")
		}

		if record.EventType == "" {
			return fmt.Errorf("usage type is required")
		}

		if record.Count < 0 {
			return fmt.Errorf("count cannot be negative")
		}
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

func convertIntervalUnit(unit rpc.IntervalUnit) repository.IntervalConfigUnit {
	switch unit {
	case rpc.IntervalUnit_interval_unit_hour:
		return repository.IntervalUnitHour
	case rpc.IntervalUnit_interval_unit_minute:
		return repository.IntervalUnitMinute
	case rpc.IntervalUnit_interval_unit_day:
		return repository.IntervalUnitDay
	default:
		return repository.IntervalUnitHour // Default to hour if unspecified
	}
}
