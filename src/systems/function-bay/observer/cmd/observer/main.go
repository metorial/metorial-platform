package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/metorial/function-bay-observer/internal/api"
	"github.com/metorial/function-bay-observer/internal/store"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	ingestAddr := envOrDefault("OBSERVER_INGEST_ADDR", ":52210")
	queryAddr := envOrDefault("OBSERVER_QUERY_ADDR", ":52211")

	db, err := store.Open(store.Config{
		Host:     mustGetEnv("DATABASE_HOST"),
		Port:     mustGetEnv("DATABASE_PORT"),
		Name:     mustGetEnv("DATABASE_NAME"),
		Username: mustGetEnv("DATABASE_USERNAME"),
		Password: mustGetEnv("DATABASE_PASSWORD"),
		SSLMode:  envOrDefault("DATABASE_SSLMODE", "require"),
	})
	if err != nil {
		logger.Error("failed to open observer database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	startCleanup(logger, db)

	ingestServer := &http.Server{
		Addr:              ingestAddr,
		Handler:           ingestHandler(logger, db),
		ReadHeaderTimeout: 5 * time.Second,
	}
	queryServer := &http.Server{
		Addr:              queryAddr,
		Handler:           queryHandler(logger, db),
		ReadHeaderTimeout: 5 * time.Second,
	}

	errs := make(chan error, 2)
	go func() {
		logger.Info("starting observer ingest api", "addr", ingestAddr)
		errs <- ingestServer.ListenAndServe()
	}()
	go func() {
		logger.Info("starting observer query api", "addr", queryAddr)
		errs <- queryServer.ListenAndServe()
	}()

	if err := <-errs; err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("observer server exited", "error", err)
		os.Exit(1)
	}
}

func ingestHandler(logger *slog.Logger, db *store.Store) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", health)
	mux.HandleFunc("/ingest", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		defer r.Body.Close()

		var batch api.IngestBatch
		if err := json.NewDecoder(r.Body).Decode(&batch); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		inserted, err := db.Ingest(r.Context(), batch)
		if err != nil {
			logger.Warn("observer ingest failed", "batchId", batch.ID, "error", err)
			http.Error(w, "ingest failed", http.StatusBadRequest)
			return
		}

		writeJSON(w, map[string]any{
			"ok":       true,
			"inserted": inserted,
		})
	})
	return mux
}

func queryHandler(logger *slog.Logger, db *store.Store) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", health)
	mux.HandleFunc("/logs", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		query, err := parseQuery(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		records, err := db.Query(r.Context(), query)
		if err != nil {
			logger.Warn("observer query failed", "error", err)
			http.Error(w, "query failed", http.StatusInternalServerError)
			return
		}
		writeJSON(w, api.LogsResponse{Records: records})
	})
	return mux
}

func parseQuery(r *http.Request) (store.Query, error) {
	values := r.URL.Query()
	query := store.Query{
		TenantID:        values.Get("tenantId"),
		EnclaveIDs:      queryList(values, "enclaveId"),
		FunctionIDs:     queryList(values, "functionId"),
		Hostnames:       queryList(values, "hostname"),
		IPs:             queryList(values, "ip"),
		IntervalMinutes: 30,
	}

	var err error
	if raw := values.Get("from"); raw != "" {
		query.From, err = time.Parse(time.RFC3339, raw)
		if err != nil {
			return store.Query{}, errors.New("from must be RFC3339")
		}
	}
	if raw := values.Get("to"); raw != "" {
		query.To, err = time.Parse(time.RFC3339, raw)
		if err != nil {
			return store.Query{}, errors.New("to must be RFC3339")
		}
	}
	if raw := values.Get("intervalMinutes"); raw != "" {
		query.IntervalMinutes, err = strconv.Atoi(raw)
		if err != nil {
			return store.Query{}, errors.New("intervalMinutes must be a number")
		}
		if query.IntervalMinutes < 30 || query.IntervalMinutes%30 != 0 {
			return store.Query{}, errors.New("intervalMinutes must be a multiple of 30")
		}
	}
	return query, nil
}

func queryList(values map[string][]string, key string) []string {
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

func health(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(value); err != nil {
		http.Error(w, "json encode failed", http.StatusInternalServerError)
	}
}

func envOrDefault(name string, fallback string) string {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	return value
}

func mustGetEnv(name string) string {
	value := os.Getenv(name)
	if value == "" {
		panic(name + " is required")
	}
	return value
}

func startCleanup(logger *slog.Logger, db *store.Store) {
	retention := envDurationHours("OBSERVER_RETENTION_HOURS", 7*24*time.Hour)
	interval := envDurationSeconds("OBSERVER_CLEANUP_INTERVAL_SECONDS", time.Hour)

	go func() {
		runCleanup(logger, db, retention)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			runCleanup(logger, db, retention)
		}
	}()
}

func runCleanup(logger *slog.Logger, db *store.Store, retention time.Duration) {
	cutoff := time.Now().UTC().Add(-retention)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	deleted, err := db.CleanupBefore(ctx, cutoff)
	if err != nil {
		logger.Warn("observer cleanup failed", "error", err)
		return
	}
	if deleted > 0 {
		logger.Info("observer cleanup deleted old logs", "count", deleted, "cutoff", cutoff.Format(time.RFC3339))
	}
}

func envDurationSeconds(name string, fallback time.Duration) time.Duration {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return fallback
	}
	return time.Duration(seconds) * time.Second
}

func envDurationHours(name string, fallback time.Duration) time.Duration {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	hours, err := strconv.Atoi(raw)
	if err != nil || hours <= 0 {
		return fallback
	}
	return time.Duration(hours) * time.Hour
}
