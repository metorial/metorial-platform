package api

import "time"

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

type IngestBatch struct {
	ID                  string        `json:"id"`
	DeflectorInstanceID string        `json:"deflectorInstanceId"`
	Records             []Observation `json:"records"`
}

type LogsResponse struct {
	Records []Observation `json:"records"`
}
