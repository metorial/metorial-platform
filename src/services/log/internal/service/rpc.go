package service

import (
	"context"
	"encoding/json"

	"github.com/metorial/metorial/modules/util"
	"github.com/metorial/metorial/services/log/gen/rpc"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/metorial/metorial/services/log/internal/entries"
	"github.com/metorial/metorial/services/log/internal/store"
)

type RcpService struct {
	rpc.UnimplementedLogServiceServer

	entryRegistry *entries.EntryTypeRegistry
	storeRegistry *store.StoreTypeRegistry
}

func newRcpService(s *LogService) *RcpService {
	return &RcpService{
		entryRegistry: s.entryRegistry,
		storeRegistry: s.storeRegistry,
	}
}

func (s *RcpService) IngestLog(ctx context.Context, req *rpc.IngestLogRequest) (*rpc.IngestLogResponse, error) {
	entryType, exists := s.storeRegistry.Get(req.EntityType)
	if !exists {
		return nil, status.Errorf(codes.InvalidArgument, "unknown entity type: %s", req.EntityType)
	}

	if err := entryType.IngestLog(ctx, req.InstanceId, req.EntityId, req.PayloadJson, req.Timestamp); err != nil {
		return nil, err
	}

	return &rpc.IngestLogResponse{}, nil
}

func (s *RcpService) ListLogs(ctx context.Context, req *rpc.ListLogsRequest) (*rpc.ListLogsResponse, error) {
	entryType, exists := s.storeRegistry.Get(req.EntityType)
	if !exists {
		return nil, status.Errorf(codes.InvalidArgument, "unknown entity type: %s", req.EntityType)
	}

	docs, err := entryType.ListLogs(ctx, &store.LogFilter{
		EntityType:   req.EntityType,
		EntityIds:    req.EntityIds,
		InstanceIds:  req.InstanceIds,
		FilterJson:   req.FilterJson,
		Pagination:   req.Pagination,
		TimestampMin: req.MinTimestamp,
		TimestampMax: req.MaxTimestamp,
	})
	if err != nil {
		return nil, err
	}

	logs := make([]*rpc.LogEntryLight, len(docs))
	for i, doc := range docs {
		logs[i] = &rpc.LogEntryLight{
			EntityId:   doc.EntityID,
			EntityType: doc.EntityType,
			InstanceId: doc.InstanceID,
			FieldsJson: string(util.Must(json.Marshal(doc.Fields))),
			Timestamp:  doc.Timestamp,
		}
	}

	response := &rpc.ListLogsResponse{
		Logs: logs,
	}

	return response, nil
}

func (s *RcpService) GetLog(ctx context.Context, req *rpc.GetLogRequest) (*rpc.GetLogResponse, error) {
	entryType, exists := s.storeRegistry.Get(req.EntityType)
	if !exists {
		return nil, status.Errorf(codes.InvalidArgument, "unknown entity type: %s", req.EntityType)
	}

	doc, payload, err := entryType.GetLog(ctx, req.EntityId, req.InstanceId)
	if err != nil {
		return nil, err
	}

	return &rpc.GetLogResponse{
		Log: &rpc.LogEntry{
			EntityId:    doc.EntityID,
			EntityType:  doc.EntityType,
			InstanceId:  doc.InstanceID,
			PayloadJson: string(*payload),
			FieldsJson:  string(util.Must(json.Marshal(doc.Fields))),
			Timestamp:   doc.Timestamp,
		},
	}, nil
}
