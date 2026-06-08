package observer

import (
	"context"
	"strconv"
	"sync"
	"time"

	"github.com/metorial/function-bay-deflector/internal/policy"
)

const bucketDuration = 30 * time.Minute

type Observation struct {
	BucketStart         time.Time `json:"bucketStart"`
	TenantID            string    `json:"tenantId"`
	FunctionID          string    `json:"functionId"`
	EffectiveFunctionID string    `json:"effectiveFunctionId,omitempty"`
	EnclaveID           string    `json:"enclaveId,omitempty"`
	Hostname            string    `json:"hostname"`
	IP                  string    `json:"ip"`
	Port                int       `json:"port"`
	Count               int64     `json:"count"`
	FirstSeenAt         time.Time `json:"firstSeenAt"`
	LastSeenAt          time.Time `json:"lastSeenAt"`
}

type Batch struct {
	ID                  string        `json:"id"`
	DeflectorInstanceID string        `json:"deflectorInstanceId"`
	Records             []Observation `json:"records"`
}

type Sender interface {
	Send(ctx context.Context, batch Batch) error
}

type Recorder struct {
	mu         sync.Mutex
	instanceID string
	maxAge     time.Duration
	now        func() time.Time
	sequence   uint64
	active     map[observationKey]Observation
	pending    *Batch
}

type observationKey struct {
	bucketStart         int64
	tenantID            string
	functionID          string
	effectiveFunctionID string
	enclaveID           string
	hostname            string
	ip                  string
	port                int
}

func NewRecorder(instanceID string, maxAge time.Duration) *Recorder {
	return &Recorder{
		instanceID: instanceID,
		maxAge:     maxAge,
		now:        time.Now,
		active:     map[observationKey]Observation{},
	}
}

func (r *Recorder) Record(claims policy.Claims, hostname string, ip string, port string) {
	if r == nil {
		return
	}

	parsedPort, err := strconv.Atoi(port)
	if err != nil {
		return
	}

	now := r.now().UTC()
	record := Observation{
		BucketStart:         now.Truncate(bucketDuration),
		TenantID:            claims.TenantID,
		FunctionID:          claims.FunctionID,
		EffectiveFunctionID: claims.EffectiveFunctionID,
		EnclaveID:           claims.EnclaveID,
		Hostname:            hostname,
		IP:                  ip,
		Port:                parsedPort,
		Count:               1,
		FirstSeenAt:         now,
		LastSeenAt:          now,
	}

	key := observationKey{
		bucketStart:         record.BucketStart.Unix(),
		tenantID:            record.TenantID,
		functionID:          record.FunctionID,
		effectiveFunctionID: record.EffectiveFunctionID,
		enclaveID:           record.EnclaveID,
		hostname:            record.Hostname,
		ip:                  record.IP,
		port:                record.Port,
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	existing, ok := r.active[key]
	if !ok {
		r.active[key] = record
		return
	}

	existing.Count++
	if record.FirstSeenAt.Before(existing.FirstSeenAt) {
		existing.FirstSeenAt = record.FirstSeenAt
	}
	if record.LastSeenAt.After(existing.LastSeenAt) {
		existing.LastSeenAt = record.LastSeenAt
	}
	r.active[key] = existing
}

func (r *Recorder) Flush(ctx context.Context, sender Sender) error {
	if r == nil || sender == nil {
		return nil
	}

	batch := r.nextBatch()
	if batch == nil {
		return nil
	}

	if err := sender.Send(ctx, *batch); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.pending != nil && r.pending.ID == batch.ID {
		r.pending = nil
	}
	return nil
}

func (r *Recorder) nextBatch() *Batch {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.dropExpiredLocked()
	if r.pending != nil {
		if len(r.pending.Records) == 0 {
			r.pending = nil
		} else {
			copy := *r.pending
			copy.Records = append([]Observation(nil), r.pending.Records...)
			return &copy
		}
	}

	if len(r.active) == 0 {
		return nil
	}

	records := make([]Observation, 0, len(r.active))
	for _, record := range r.active {
		records = append(records, record)
	}
	r.active = map[observationKey]Observation{}
	r.sequence++
	r.pending = &Batch{
		ID:                  r.instanceID + ":" + strconv.FormatUint(r.sequence, 10),
		DeflectorInstanceID: r.instanceID,
		Records:             records,
	}

	copy := *r.pending
	copy.Records = append([]Observation(nil), r.pending.Records...)
	return &copy
}

func (r *Recorder) dropExpiredLocked() {
	if r.maxAge <= 0 {
		return
	}

	cutoff := r.now().UTC().Add(-r.maxAge)
	for key, record := range r.active {
		if record.LastSeenAt.Before(cutoff) {
			delete(r.active, key)
		}
	}
	if r.pending != nil {
		records := r.pending.Records[:0]
		for _, record := range r.pending.Records {
			if !record.LastSeenAt.Before(cutoff) {
				records = append(records, record)
			}
		}
		r.pending.Records = records
		if len(r.pending.Records) == 0 {
			r.pending = nil
		}
	}
}
