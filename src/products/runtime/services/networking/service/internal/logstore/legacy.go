package logstore

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// The legacy observer API, kept while the deflector and function-bay's OBSERVER_QUERY_URL
// still use it. Its observations are allowed Lambda traffic, and /logs only returns those.

type legacyObservation struct {
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

type legacyBatch struct {
	ID                  string              `json:"id"`
	DeflectorInstanceID string              `json:"deflectorInstanceId"`
	Records             []legacyObservation `json:"records"`
}

const legacyMaxBodyBytes = 32 << 20

func LegacyIngestHandler(store *Store, logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", health)
	mux.HandleFunc("/ingest", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var batch legacyBatch
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, legacyMaxBodyBytes)).Decode(&batch); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		records := make([]Record, 0, len(batch.Records))
		for _, observation := range batch.Records {
			if observation.Port <= 0 {
				http.Error(w, "ingest failed", http.StatusBadRequest)
				return
			}
			records = append(records, Record{
				BucketStart:         observation.BucketStart,
				TenantID:            observation.TenantID,
				FunctionID:          observation.FunctionID,
				EffectiveFunctionID: observation.EffectiveFunctionID,
				EnclaveID:           observation.EnclaveID,
				Hostname:            observation.Hostname,
				IP:                  observation.IP,
				Port:                observation.Port,
				Decision:            DecisionAllowed,
				Source:              SourceLambda,
				Count:               observation.Count,
				FirstSeenAt:         observation.FirstSeenAt,
				LastSeenAt:          observation.LastSeenAt,
			})
		}

		inserted, err := store.Ingest(r.Context(), Batch{ID: batch.ID, InstanceID: batch.DeflectorInstanceID, Records: records})
		if err != nil {
			logger.Warn("legacy ingest failed", "batchId", batch.ID, "error", err)
			http.Error(w, "ingest failed", http.StatusBadRequest)
			return
		}
		writeJSON(w, map[string]any{"ok": true, "inserted": inserted})
	})
	return mux
}

func LegacyQueryHandler(store *Store, logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", health)
	mux.HandleFunc("/logs", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		query, err := parseLegacyQuery(r.URL.Query())
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		records, err := store.List(r.Context(), query)
		if err != nil {
			logger.Warn("legacy query failed", "error", err)
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}

		response := struct {
			Records []legacyObservation `json:"records"`
		}{Records: make([]legacyObservation, 0, len(records))}
		for _, record := range records {
			response.Records = append(response.Records, legacyObservation{
				BucketStart:         record.BucketStart,
				TenantID:            record.TenantID,
				FunctionID:          record.FunctionID,
				EffectiveFunctionID: record.EffectiveFunctionID,
				EnclaveID:           record.EnclaveID,
				Hostname:            record.Hostname,
				IP:                  record.IP,
				Port:                record.Port,
				Count:               record.Count,
				FirstSeenAt:         record.FirstSeenAt,
				LastSeenAt:          record.LastSeenAt,
			})
		}
		writeJSON(w, response)
	})
	return mux
}

func parseLegacyQuery(values url.Values) (Query, error) {
	query := Query{
		TenantID:        values.Get("tenantId"),
		EnclaveIDs:      legacyList(values, "enclaveId"),
		FunctionIDs:     legacyList(values, "functionId"),
		Hostnames:       legacyList(values, "hostname"),
		IPs:             legacyList(values, "ip"),
		Decision:        DecisionAllowed,
		IntervalMinutes: 30,
	}

	var err error
	if raw := values.Get("from"); raw != "" {
		if query.From, err = time.Parse(time.RFC3339, raw); err != nil {
			return Query{}, errors.New("from must be RFC3339")
		}
	}
	if raw := values.Get("to"); raw != "" {
		if query.To, err = time.Parse(time.RFC3339, raw); err != nil {
			return Query{}, errors.New("to must be RFC3339")
		}
	}
	if raw := values.Get("intervalMinutes"); raw != "" {
		if query.IntervalMinutes, err = strconv.Atoi(raw); err != nil {
			return Query{}, errors.New("intervalMinutes must be a number")
		}
		if query.IntervalMinutes < 30 || query.IntervalMinutes%30 != 0 {
			return Query{}, errors.New("intervalMinutes must be a multiple of 30")
		}
	}
	return query, nil
}

func legacyList(values url.Values, key string) []string {
	out := []string{}
	for _, candidate := range []string{key, key + "[]"} {
		for _, value := range values[candidate] {
			if value != "" {
				out = append(out, value)
			}
		}
	}
	return out
}

func health(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}
