package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/metorial/function-bay-observer/internal/api"
	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

type Query struct {
	TenantID          string
	EnclaveID         string
	EnclaveIdentifier string
	FunctionID        string
	Hostname          string
	From              time.Time
	To                time.Time
}

func Open(path string) (*Store, error) {
	if path == "" {
		return nil, errors.New("sqlite path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)

	store := &Store{db: db}
	if err := store.init(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}
	return store, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) init(ctx context.Context) error {
	statements := []string{
		`PRAGMA journal_mode = WAL`,
		`PRAGMA busy_timeout = 5000`,
		`CREATE TABLE IF NOT EXISTS ingest_batches (
			id TEXT PRIMARY KEY,
			deflector_instance_id TEXT NOT NULL,
			received_at INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS network_observations (
			bucket_start INTEGER NOT NULL,
			tenant_id TEXT NOT NULL,
			enclave_id TEXT NOT NULL,
			enclave_identifier TEXT NOT NULL,
			function_id TEXT NOT NULL,
			effective_function_id TEXT NOT NULL,
			function_version_id TEXT NOT NULL,
			hostname TEXT NOT NULL,
			ip TEXT NOT NULL,
			port INTEGER NOT NULL,
			count INTEGER NOT NULL,
			first_seen_at INTEGER NOT NULL,
			last_seen_at INTEGER NOT NULL,
			PRIMARY KEY (
				bucket_start,
				tenant_id,
				enclave_id,
				enclave_identifier,
				function_id,
				effective_function_id,
				function_version_id,
				hostname,
				ip,
				port
			)
		)`,
	}

	for _, statement := range statements {
		if _, err := s.db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) Ingest(ctx context.Context, batch api.IngestBatch) (bool, error) {
	if batch.ID == "" {
		return false, errors.New("batch id is required")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(
		ctx,
		`INSERT OR IGNORE INTO ingest_batches (id, deflector_instance_id, received_at) VALUES (?, ?, ?)`,
		batch.ID,
		batch.DeflectorInstanceID,
		time.Now().UTC().Unix(),
	)
	if err != nil {
		return false, err
	}
	inserted, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	if inserted == 0 {
		return false, tx.Commit()
	}

	for _, record := range batch.Records {
		if err := upsertObservation(ctx, tx, record); err != nil {
			return false, err
		}
	}

	if err := tx.Commit(); err != nil {
		return false, err
	}
	return true, nil
}

func upsertObservation(ctx context.Context, tx *sql.Tx, record api.Observation) error {
	if record.TenantID == "" || record.FunctionID == "" || record.FunctionVersionID == "" {
		return errors.New("observation is missing required identity fields")
	}
	if record.Hostname == "" || record.IP == "" || record.Port <= 0 {
		return errors.New("observation is missing destination fields")
	}
	if record.Count <= 0 {
		record.Count = 1
	}

	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO network_observations (
			bucket_start,
			tenant_id,
			enclave_id,
			enclave_identifier,
			function_id,
			effective_function_id,
			function_version_id,
			hostname,
			ip,
			port,
			count,
			first_seen_at,
			last_seen_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (
			bucket_start,
			tenant_id,
			enclave_id,
			enclave_identifier,
			function_id,
			effective_function_id,
			function_version_id,
			hostname,
			ip,
			port
		) DO UPDATE SET
			count = network_observations.count + excluded.count,
			first_seen_at = min(network_observations.first_seen_at, excluded.first_seen_at),
			last_seen_at = max(network_observations.last_seen_at, excluded.last_seen_at)`,
		record.BucketStart.UTC().Unix(),
		record.TenantID,
		record.EnclaveID,
		record.EnclaveIdentifier,
		record.FunctionID,
		record.EffectiveFunctionID,
		record.FunctionVersionID,
		record.Hostname,
		record.IP,
		record.Port,
		record.Count,
		record.FirstSeenAt.UTC().Unix(),
		record.LastSeenAt.UTC().Unix(),
	)
	return err
}

func (s *Store) Query(ctx context.Context, query Query) ([]api.Observation, error) {
	clauses := []string{"1 = 1"}
	args := []any{}

	if !query.From.IsZero() {
		clauses = append(clauses, "bucket_start >= ?")
		args = append(args, query.From.UTC().Unix())
	}
	if !query.To.IsZero() {
		clauses = append(clauses, "bucket_start < ?")
		args = append(args, query.To.UTC().Unix())
	}
	addTextFilter := func(column string, value string) {
		if value == "" {
			return
		}
		clauses = append(clauses, fmt.Sprintf("%s = ?", column))
		args = append(args, value)
	}
	addTextFilter("tenant_id", query.TenantID)
	addTextFilter("enclave_id", query.EnclaveID)
	addTextFilter("enclave_identifier", query.EnclaveIdentifier)
	addTextFilter("function_id", query.FunctionID)
	addTextFilter("hostname", query.Hostname)

	rows, err := s.db.QueryContext(
		ctx,
		`SELECT
			bucket_start,
			tenant_id,
			enclave_id,
			enclave_identifier,
			function_id,
			effective_function_id,
			function_version_id,
			hostname,
			ip,
			port,
			count,
			first_seen_at,
			last_seen_at
		FROM network_observations
		WHERE `+strings.Join(clauses, " AND ")+`
		ORDER BY bucket_start DESC, last_seen_at DESC
		LIMIT 1000`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := []api.Observation{}
	for rows.Next() {
		var record api.Observation
		var bucketStart int64
		var firstSeenAt int64
		var lastSeenAt int64
		if err := rows.Scan(
			&bucketStart,
			&record.TenantID,
			&record.EnclaveID,
			&record.EnclaveIdentifier,
			&record.FunctionID,
			&record.EffectiveFunctionID,
			&record.FunctionVersionID,
			&record.Hostname,
			&record.IP,
			&record.Port,
			&record.Count,
			&firstSeenAt,
			&lastSeenAt,
		); err != nil {
			return nil, err
		}
		record.BucketStart = time.Unix(bucketStart, 0).UTC()
		record.FirstSeenAt = time.Unix(firstSeenAt, 0).UTC()
		record.LastSeenAt = time.Unix(lastSeenAt, 0).UTC()
		records = append(records, record)
	}
	return records, rows.Err()
}

func (s *Store) CleanupBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(
		ctx,
		`DELETE FROM network_observations WHERE bucket_start < ?`,
		cutoff.UTC().Unix(),
	)
	if err != nil {
		return 0, err
	}
	deleted, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}

	_, err = tx.ExecContext(
		ctx,
		`DELETE FROM ingest_batches WHERE received_at < ?`,
		cutoff.UTC().Unix(),
	)
	if err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return deleted, nil
}
