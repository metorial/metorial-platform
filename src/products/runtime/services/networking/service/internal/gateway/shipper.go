package gateway

import (
	"context"
	"log/slog"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/rpc/networklogsrpc"
)

type RPCSender struct {
	Client *networklogsrpc.Client
}

func (s *RPCSender) Send(ctx context.Context, batch Batch) error {
	input := &networklogsrpc.ObservationIngestManyInput{
		BatchID:           batch.ID,
		GatewayInstanceID: batch.InstanceID,
		Observations:      make([]networklogsrpc.Observation, 0, len(batch.Observations)),
	}
	for _, observation := range batch.Observations {
		input.Observations = append(input.Observations, networklogsrpc.Observation{
			BucketStart:         observation.BucketStart,
			TenantID:            observation.TenantID,
			FunctionID:          observation.FunctionID,
			EffectiveFunctionID: optional(observation.EffectiveFunctionID),
			EnclaveID:           optional(observation.EnclaveID),
			BuildRunID:          optional(observation.BuildRunID),
			Hostname:            observation.Hostname,
			IP:                  observation.IP,
			Port:                int64(observation.Port),
			Decision:            networklogsrpc.Decision(observation.Decision),
			Source:              networklogsrpc.Source(observation.Source),
			Count:               observation.Count,
			FirstSeenAt:         observation.FirstSeenAt,
			LastSeenAt:          observation.LastSeenAt,
		})
	}

	_, err := s.Client.ObservationIngestMany(ctx, input)
	return err
}

func optional(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

// Ship flushes the recorder every interval until ctx ends, then flushes once more.
func Ship(ctx context.Context, recorder *Recorder, sender Sender, interval time.Duration, metrics *Metrics, logger *slog.Logger) {
	flush := func(parent context.Context) {
		flushCtx, cancel := context.WithTimeout(parent, 20*time.Second)
		defer cancel()
		sent, err := recorder.Flush(flushCtx, sender)
		metrics.ObservationBatches.WithLabelValues("ok").Add(float64(sent))
		if err != nil {
			metrics.ObservationBatches.WithLabelValues("error").Inc()
			logger.Warn("observation flush failed", "error", err, "pending", recorder.Pending())
		}
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			flush(context.WithoutCancel(ctx))
			return
		case <-ticker.C:
			flush(ctx)
		}
	}
}
