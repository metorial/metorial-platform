package gateway

import (
	"context"
	"strconv"
	"sync"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
)

const (
	bucketDuration = 30 * time.Minute
	maxBatchSize   = 10_000
)

type Decision string

const (
	DecisionAllowed Decision = "allowed"
	DecisionDenied  Decision = "denied"
)

type Observation struct {
	BucketStart         time.Time
	TenantID            string
	FunctionID          string
	EffectiveFunctionID string
	EnclaveID           string
	BuildRunID          string
	Hostname            string
	IP                  string
	Port                int
	Decision            Decision
	Source              egress.Source
	Count               int64
	FirstSeenAt         time.Time
	LastSeenAt          time.Time
}

type Batch struct {
	ID           string
	InstanceID   string
	Observations []Observation
}

type Sender interface {
	Send(ctx context.Context, batch Batch) error
}

type observationKey struct {
	bucketStart         int64
	tenantID            string
	functionID          string
	effectiveFunctionID string
	enclaveID           string
	buildRunID          string
	hostname            string
	ip                  string
	port                int
	decision            Decision
	source              egress.Source
}

// Recorder aggregates observations per 30-minute bucket and hands them to a Sender in
// batches. A batch that fails to send is retried with the same ID until it succeeds or
// its observations age out.
type Recorder struct {
	mu         sync.Mutex
	instanceID string
	maxAge     time.Duration
	now        func() time.Time
	sequence   uint64
	active     map[observationKey]Observation
	pending    *Batch
	dropped    func(n int)
}

func NewRecorder(instanceID string, maxAge time.Duration, onDrop func(n int)) *Recorder {
	return &Recorder{
		instanceID: instanceID,
		maxAge:     maxAge,
		dropped:    onDrop,
		now:        time.Now,
		active:     map[observationKey]Observation{},
	}
}

func (r *Recorder) Record(grant *egress.Grant, hostname string, ip string, port int, decision Decision) {
	if r == nil || grant == nil {
		return
	}

	now := r.now().UTC()
	key := observationKey{
		bucketStart:         now.Truncate(bucketDuration).Unix(),
		tenantID:            grant.TenantID,
		functionID:          grant.FunctionID,
		effectiveFunctionID: grant.EffectiveFunctionID,
		enclaveID:           grant.EnclaveID,
		buildRunID:          grant.BuildRunID,
		hostname:            hostname,
		ip:                  ip,
		port:                port,
		decision:            decision,
		source:              grant.Source,
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	existing, ok := r.active[key]
	if !ok {
		r.active[key] = Observation{
			BucketStart:         now.Truncate(bucketDuration),
			TenantID:            grant.TenantID,
			FunctionID:          grant.FunctionID,
			EffectiveFunctionID: grant.EffectiveFunctionID,
			EnclaveID:           grant.EnclaveID,
			BuildRunID:          grant.BuildRunID,
			Hostname:            hostname,
			IP:                  ip,
			Port:                port,
			Decision:            decision,
			Source:              grant.Source,
			Count:               1,
			FirstSeenAt:         now,
			LastSeenAt:          now,
		}
		return
	}

	existing.Count++
	existing.LastSeenAt = now
	r.active[key] = existing
}

// Flush sends everything recorded so far, in batches of at most maxBatchSize.
func (r *Recorder) Flush(ctx context.Context, sender Sender) (int, error) {
	if r == nil || sender == nil {
		return 0, nil
	}

	sent := 0
	for {
		batch := r.nextBatch()
		if batch == nil {
			return sent, nil
		}
		if err := sender.Send(ctx, *batch); err != nil {
			return sent, err
		}
		sent++

		r.mu.Lock()
		if r.pending != nil && r.pending.ID == batch.ID {
			r.pending = nil
		}
		r.mu.Unlock()
	}
}

func (r *Recorder) Pending() int {
	r.mu.Lock()
	defer r.mu.Unlock()

	n := len(r.active)
	if r.pending != nil {
		n += len(r.pending.Observations)
	}
	return n
}

func (r *Recorder) nextBatch() *Batch {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.dropExpiredLocked()
	if r.pending == nil {
		if len(r.active) == 0 {
			return nil
		}

		observations := make([]Observation, 0, min(len(r.active), maxBatchSize))
		for key, observation := range r.active {
			if len(observations) == maxBatchSize {
				break
			}
			observations = append(observations, observation)
			delete(r.active, key)
		}
		r.sequence++
		r.pending = &Batch{
			ID:           r.instanceID + ":" + strconv.FormatUint(r.sequence, 10),
			InstanceID:   r.instanceID,
			Observations: observations,
		}
	}

	batch := *r.pending
	batch.Observations = append([]Observation(nil), r.pending.Observations...)
	return &batch
}

func (r *Recorder) dropExpiredLocked() {
	if r.maxAge <= 0 {
		return
	}

	cutoff := r.now().UTC().Add(-r.maxAge)
	dropped := 0
	for key, observation := range r.active {
		if observation.LastSeenAt.Before(cutoff) {
			delete(r.active, key)
			dropped++
		}
	}
	if r.pending != nil {
		kept := r.pending.Observations[:0]
		for _, observation := range r.pending.Observations {
			if observation.LastSeenAt.Before(cutoff) {
				dropped++
				continue
			}
			kept = append(kept, observation)
		}
		r.pending.Observations = kept
		if len(kept) == 0 {
			r.pending = nil
		}
	}
	if dropped > 0 && r.dropped != nil {
		r.dropped(dropped)
	}
}
