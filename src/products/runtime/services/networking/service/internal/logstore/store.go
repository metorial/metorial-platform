package logstore

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	DecisionAllowed = "allowed"
	DecisionDenied  = "denied"

	SourceLambda  = "lambda"
	SourceKnative = "knative"
	SourceBuild   = "build"

	bucketSeconds = 30 * 60
	queryLimit    = 1000
)

var (
	ErrInvalidInterval = errors.New("interval must be a multiple of 30 minutes")
	ErrInvalidRecord   = errors.New("invalid observation")
)

type Config struct {
	Host     string
	Port     string
	Name     string
	Username string
	Password string
	SSLMode  string
}

func (c Config) DSN(database string) string {
	sslMode := c.SSLMode
	if sslMode == "" {
		sslMode = "require"
	}
	return (&url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(c.Username, c.Password),
		Host:     net.JoinHostPort(c.Host, c.Port),
		Path:     database,
		RawQuery: url.Values{"sslmode": {sslMode}}.Encode(),
	}).String()
}

type Record struct {
	BucketStart         time.Time
	TenantID            string
	FunctionID          string
	EffectiveFunctionID string
	EnclaveID           string
	BuildRunID          string
	Hostname            string
	IP                  string
	Port                int
	Decision            string
	Source              string
	Count               int64
	FirstSeenAt         time.Time
	LastSeenAt          time.Time
}

type Batch struct {
	ID         string
	InstanceID string
	Records    []Record
}

type Query struct {
	TenantID        string
	EnclaveIDs      []string
	FunctionIDs     []string
	Hostnames       []string
	IPs             []string
	Decision        string
	From            time.Time
	To              time.Time
	IntervalMinutes int
}

type Store struct {
	pool *pgxpool.Pool
}

// Open creates the database if it doesn't exist, connects and migrates the schema.
func Open(ctx context.Context, cfg Config) (*Store, error) {
	if cfg.Host == "" || cfg.Port == "" || cfg.Name == "" || cfg.Username == "" {
		return nil, errors.New("database host, port, name and username are required")
	}
	if err := ensureDatabase(ctx, cfg); err != nil {
		return nil, err
	}

	poolConfig, err := pgxpool.ParseConfig(cfg.DSN(cfg.Name))
	if err != nil {
		return nil, err
	}
	poolConfig.MaxConns = 10
	poolConfig.MaxConnLifetime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, err
	}

	store := &Store{pool: pool}
	if err := store.Migrate(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return store, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

func ensureDatabase(ctx context.Context, cfg Config) error {
	conn, err := pgx.Connect(ctx, cfg.DSN("postgres"))
	if err != nil {
		return err
	}
	defer conn.Close(context.WithoutCancel(ctx))

	var exists bool
	if err := conn.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)`, cfg.Name).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil
	}
	_, err = conn.Exec(ctx, `CREATE DATABASE `+pgx.Identifier{cfg.Name}.Sanitize())
	if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == "42P04" {
		return nil
	}
	return err
}

// Ingest stores a batch once; a repeated batch ID returns false without changing anything.
func (s *Store) Ingest(ctx context.Context, batch Batch) (bool, error) {
	if batch.ID == "" {
		return false, errors.New("batch id is required")
	}

	records, err := mergeRecords(batch.Records)
	if err != nil {
		return false, err
	}

	inserted := false
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx,
			`INSERT INTO ingest_batches (id, deflector_instance_id, received_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
			batch.ID, batch.InstanceID, time.Now().UTC().Unix(),
		)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return nil
		}
		inserted = true

		if len(records) == 0 {
			return nil
		}
		return upsert(ctx, tx, records)
	})
	return inserted, err
}

func upsert(ctx context.Context, tx pgx.Tx, records []Record) error {
	columns := struct {
		bucketStart, port, count, firstSeen, lastSeen                               []int64
		tenant, enclave, function, effective, buildRun, hostname, ip, decision, src []string
	}{}
	for _, record := range records {
		columns.bucketStart = append(columns.bucketStart, record.BucketStart.UTC().Unix())
		columns.tenant = append(columns.tenant, record.TenantID)
		columns.enclave = append(columns.enclave, record.EnclaveID)
		columns.function = append(columns.function, record.FunctionID)
		columns.effective = append(columns.effective, record.EffectiveFunctionID)
		columns.buildRun = append(columns.buildRun, record.BuildRunID)
		columns.hostname = append(columns.hostname, record.Hostname)
		columns.ip = append(columns.ip, record.IP)
		columns.port = append(columns.port, int64(record.Port))
		columns.decision = append(columns.decision, record.Decision)
		columns.src = append(columns.src, record.Source)
		columns.count = append(columns.count, record.Count)
		columns.firstSeen = append(columns.firstSeen, record.FirstSeenAt.UTC().Unix())
		columns.lastSeen = append(columns.lastSeen, record.LastSeenAt.UTC().Unix())
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO network_observations (
			bucket_start, tenant_id, enclave_id, function_id, effective_function_id, build_run_id,
			hostname, ip, port, decision, source, count, first_seen_at, last_seen_at
		)
		SELECT * FROM unnest(
			$1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
			$7::text[], $8::text[], $9::bigint[], $10::text[], $11::text[], $12::bigint[], $13::bigint[], $14::bigint[]
		)
		ON CONFLICT (`+primaryKeyList+`) DO UPDATE SET
			count = network_observations.count + EXCLUDED.count,
			first_seen_at = LEAST(network_observations.first_seen_at, EXCLUDED.first_seen_at),
			last_seen_at = GREATEST(network_observations.last_seen_at, EXCLUDED.last_seen_at)`,
		columns.bucketStart, columns.tenant, columns.enclave, columns.function, columns.effective, columns.buildRun,
		columns.hostname, columns.ip, columns.port, columns.decision, columns.src, columns.count, columns.firstSeen, columns.lastSeen,
	)
	return err
}

type recordKey struct {
	bucketStart                                    int64
	tenant, enclave, function, effective, buildRun string
	hostname, ip                                   string
	port                                           int
	decision, source                               string
}

// mergeRecords validates records and sums duplicates, since one INSERT ... ON CONFLICT
// can't touch the same row twice.
func mergeRecords(records []Record) ([]Record, error) {
	merged := make([]Record, 0, len(records))
	index := make(map[recordKey]int, len(records))

	for _, record := range records {
		if err := validateRecord(&record); err != nil {
			return nil, fmt.Errorf("%w: %v", ErrInvalidRecord, err)
		}
		key := recordKey{
			bucketStart: record.BucketStart.UTC().Unix(),
			tenant:      record.TenantID, enclave: record.EnclaveID, function: record.FunctionID,
			effective: record.EffectiveFunctionID, buildRun: record.BuildRunID,
			hostname: record.Hostname, ip: record.IP, port: record.Port,
			decision: record.Decision, source: record.Source,
		}
		if i, ok := index[key]; ok {
			existing := &merged[i]
			existing.Count += record.Count
			if record.FirstSeenAt.Before(existing.FirstSeenAt) {
				existing.FirstSeenAt = record.FirstSeenAt
			}
			if record.LastSeenAt.After(existing.LastSeenAt) {
				existing.LastSeenAt = record.LastSeenAt
			}
			continue
		}
		index[key] = len(merged)
		merged = append(merged, record)
	}
	return merged, nil
}

func validateRecord(record *Record) error {
	if record.Hostname == "" || record.IP == "" {
		return errors.New("observation is missing destination fields")
	}
	if record.Port < 0 || record.Port > 65535 {
		return fmt.Errorf("observation port %d is out of range", record.Port)
	}
	switch record.Decision {
	case DecisionAllowed, DecisionDenied:
	default:
		return fmt.Errorf("unknown decision %q", record.Decision)
	}
	switch record.Source {
	case SourceLambda, SourceKnative:
		if record.TenantID == "" || record.FunctionID == "" {
			return errors.New("function observation is missing tenantId or functionId")
		}
	case SourceBuild:
		if record.BuildRunID == "" {
			return errors.New("build observation is missing buildRunId")
		}
	default:
		return fmt.Errorf("unknown source %q", record.Source)
	}
	if record.Count <= 0 {
		record.Count = 1
	}
	if record.FirstSeenAt.IsZero() {
		record.FirstSeenAt = record.BucketStart
	}
	if record.LastSeenAt.IsZero() {
		record.LastSeenAt = record.FirstSeenAt
	}
	return nil
}

// List aggregates observations into intervals, newest first, at most 1000 rows.
func (s *Store) List(ctx context.Context, query Query) ([]Record, error) {
	interval := query.IntervalMinutes * 60
	if interval == 0 {
		interval = bucketSeconds
	}
	if interval < bucketSeconds || interval%bucketSeconds != 0 {
		return nil, ErrInvalidInterval
	}

	where := []string{"TRUE"}
	args := []any{interval}
	add := func(clause string, value any) {
		args = append(args, value)
		where = append(where, fmt.Sprintf(clause, len(args)))
	}
	if query.TenantID != "" {
		add("tenant_id = $%d", query.TenantID)
	}
	if query.Decision != "" {
		add("decision = $%d", query.Decision)
	}
	if !query.From.IsZero() {
		add("bucket_start >= $%d", query.From.UTC().Unix())
	}
	if !query.To.IsZero() {
		add("bucket_start < $%d", query.To.UTC().Unix())
	}
	for column, values := range map[string][]string{
		"enclave_id":  query.EnclaveIDs,
		"function_id": query.FunctionIDs,
		"hostname":    query.Hostnames,
		"ip":          query.IPs,
	} {
		if values = nonEmpty(values); len(values) > 0 {
			add(column+" = ANY($%d)", values)
		}
	}

	rows, err := s.pool.Query(ctx, `
		SELECT
			(bucket_start / $1) * $1 AS interval_start,
			tenant_id, enclave_id, function_id, effective_function_id, build_run_id,
			hostname, ip, port, decision, source,
			SUM(count)::bigint, MIN(first_seen_at), MAX(last_seen_at)
		FROM network_observations
		WHERE `+strings.Join(where, " AND ")+`
		GROUP BY interval_start, tenant_id, enclave_id, function_id, effective_function_id, build_run_id,
			hostname, ip, port, decision, source
		ORDER BY interval_start DESC, MAX(last_seen_at) DESC
		LIMIT `+fmt.Sprint(queryLimit), args...)
	if err != nil {
		return nil, err
	}

	records, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Record, error) {
		var record Record
		var intervalStart, port, firstSeen, lastSeen int64
		err := row.Scan(
			&intervalStart, &record.TenantID, &record.EnclaveID, &record.FunctionID, &record.EffectiveFunctionID, &record.BuildRunID,
			&record.Hostname, &record.IP, &port, &record.Decision, &record.Source,
			&record.Count, &firstSeen, &lastSeen,
		)
		record.BucketStart = time.Unix(intervalStart, 0).UTC()
		record.Port = int(port)
		record.FirstSeenAt = time.Unix(firstSeen, 0).UTC()
		record.LastSeenAt = time.Unix(lastSeen, 0).UTC()
		return record, err
	})
	if err != nil {
		return nil, err
	}
	return records, nil
}

func (s *Store) CleanupBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	var deleted int64
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `DELETE FROM network_observations WHERE bucket_start < $1`, cutoff.UTC().Unix())
		if err != nil {
			return err
		}
		deleted = tag.RowsAffected()
		_, err = tx.Exec(ctx, `DELETE FROM ingest_batches WHERE received_at < $1`, cutoff.UTC().Unix())
		return err
	})
	return deleted, err
}

func nonEmpty(values []string) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value != "" {
			out = append(out, value)
		}
	}
	return out
}
