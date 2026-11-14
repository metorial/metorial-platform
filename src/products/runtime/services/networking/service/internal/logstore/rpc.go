package logstore

import (
	"context"
	"errors"
	"log/slog"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/rpc/networklogsrpc"
)

type Service struct {
	Store  *Store
	Logger *slog.Logger
}

var _ networklogsrpc.Service = (*Service)(nil)

func (s *Service) ObservationIngestMany(ctx context.Context, in *networklogsrpc.ObservationIngestManyInput) (*networklogsrpc.ObservationIngestManyOutput, error) {
	batch := Batch{ID: in.BatchID, InstanceID: in.GatewayInstanceID, Records: make([]Record, 0, len(in.Observations))}
	for _, observation := range in.Observations {
		batch.Records = append(batch.Records, Record{
			BucketStart:         observation.BucketStart,
			TenantID:            observation.TenantID,
			FunctionID:          observation.FunctionID,
			EffectiveFunctionID: deref(observation.EffectiveFunctionID),
			EnclaveID:           deref(observation.EnclaveID),
			BuildRunID:          deref(observation.BuildRunID),
			Hostname:            observation.Hostname,
			IP:                  observation.IP,
			Port:                int(observation.Port),
			Decision:            string(observation.Decision),
			Source:              string(observation.Source),
			Count:               observation.Count,
			FirstSeenAt:         observation.FirstSeenAt,
			LastSeenAt:          observation.LastSeenAt,
		})
	}

	inserted, err := s.Store.Ingest(ctx, batch)
	if errors.Is(err, ErrInvalidRecord) {
		return nil, ldrpc.NewError(400, "invalid_observation", err.Error())
	}
	if err != nil {
		s.Logger.Error("ingest failed", "batchId", in.BatchID, "error", err)
		return nil, ldrpc.InternalServerError()
	}
	return &networklogsrpc.ObservationIngestManyOutput{Inserted: inserted}, nil
}

func (s *Service) ObservationList(ctx context.Context, in *networklogsrpc.ObservationListInput) (*networklogsrpc.ObservationListOutput, error) {
	query := Query{
		TenantID:    in.TenantID,
		EnclaveIDs:  in.EnclaveIds,
		FunctionIDs: in.FunctionIds,
		Hostnames:   in.Hostnames,
		IPs:         in.Ips,
	}
	if in.Decision != nil {
		query.Decision = string(*in.Decision)
	}
	if in.From != nil {
		query.From = *in.From
	}
	if in.To != nil {
		query.To = *in.To
	}
	if in.IntervalMinutes != nil {
		query.IntervalMinutes = int(*in.IntervalMinutes)
	}

	records, err := s.Store.List(ctx, query)
	if errors.Is(err, ErrInvalidInterval) {
		return nil, ldrpc.NewError(400, "invalid_interval", err.Error())
	}
	if err != nil {
		s.Logger.Error("list failed", "tenantId", in.TenantID, "error", err)
		return nil, ldrpc.InternalServerError()
	}

	output := &networklogsrpc.ObservationListOutput{Records: make([]networklogsrpc.Observation, 0, len(records))}
	for _, record := range records {
		output.Records = append(output.Records, networklogsrpc.Observation{
			BucketStart:         record.BucketStart,
			TenantID:            record.TenantID,
			FunctionID:          record.FunctionID,
			EffectiveFunctionID: optional(record.EffectiveFunctionID),
			EnclaveID:           optional(record.EnclaveID),
			BuildRunID:          optional(record.BuildRunID),
			Hostname:            record.Hostname,
			IP:                  record.IP,
			Port:                int64(record.Port),
			Decision:            networklogsrpc.Decision(record.Decision),
			Source:              networklogsrpc.Source(record.Source),
			Count:               record.Count,
			FirstSeenAt:         record.FirstSeenAt,
			LastSeenAt:          record.LastSeenAt,
		})
	}
	return output, nil
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}
