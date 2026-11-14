package logstore

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Every log store replica must use the same key.
const migrationLockKey int64 = 0x6e65746c6f677331

var primaryKeyColumns = []string{
	"bucket_start", "tenant_id", "enclave_id", "function_id", "effective_function_id", "build_run_id",
	"hostname", "ip", "port", "decision", "source",
}

var primaryKeyList = strings.Join(primaryKeyColumns, ", ")

const newPrimaryKeyIndex = "network_observations_key_v2"

// Migrate brings the schema up to date. It accepts databases created by the legacy
// observer: the new columns get defaults matching what the observer stored (allowed
// Lambda traffic), and the primary key is widened by building the new unique index
// concurrently and swapping it in, so ingestion isn't blocked during the index build.
// The new key is a superset of the old one, so existing rows can't conflict.
func (s *Store) Migrate(ctx context.Context) error {
	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	if err := acquireMigrationLock(ctx, conn); err != nil {
		return err
	}
	defer func() {
		_, _ = conn.Exec(context.WithoutCancel(ctx), `SELECT pg_advisory_unlock($1)`, migrationLockKey)
	}()

	statements := []string{
		`CREATE TABLE IF NOT EXISTS ingest_batches (
			id text PRIMARY KEY,
			deflector_instance_id text NOT NULL,
			received_at bigint NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS network_observations (
			bucket_start bigint NOT NULL,
			tenant_id text NOT NULL,
			enclave_id text NOT NULL,
			function_id text NOT NULL,
			effective_function_id text NOT NULL,
			hostname text NOT NULL,
			ip text NOT NULL,
			port bigint NOT NULL,
			count bigint NOT NULL,
			first_seen_at bigint NOT NULL,
			last_seen_at bigint NOT NULL,
			decision text NOT NULL DEFAULT 'allowed',
			source text NOT NULL DEFAULT 'lambda',
			build_run_id text NOT NULL DEFAULT '',
			CONSTRAINT network_observations_pkey PRIMARY KEY (` + primaryKeyList + `)
		)`,
		`ALTER TABLE network_observations
			ADD COLUMN IF NOT EXISTS decision text NOT NULL DEFAULT 'allowed',
			ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'lambda',
			ADD COLUMN IF NOT EXISTS build_run_id text NOT NULL DEFAULT ''`,
		`CREATE INDEX IF NOT EXISTS ingest_batches_received_at_idx ON ingest_batches (received_at)`,
	}
	for _, statement := range statements {
		if _, err := conn.Exec(ctx, statement); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}

	return swapPrimaryKey(ctx, conn)
}

func swapPrimaryKey(ctx context.Context, conn *pgxpool.Conn) error {
	name, columns, err := currentPrimaryKey(ctx, conn)
	if err != nil {
		return err
	}
	if slices.Equal(columns, primaryKeyColumns) {
		return nil
	}

	var valid *bool
	err = conn.QueryRow(ctx, `SELECT indisvalid FROM pg_index WHERE indexrelid = to_regclass($1)`, newPrimaryKeyIndex).Scan(&valid)
	if err != nil && err != pgx.ErrNoRows {
		return err
	}
	if valid != nil && !*valid {
		if _, err := conn.Exec(ctx, `DROP INDEX CONCURRENTLY IF EXISTS `+newPrimaryKeyIndex); err != nil {
			return fmt.Errorf("migrate: drop invalid index: %w", err)
		}
	}

	if _, err := conn.Exec(ctx, `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS `+newPrimaryKeyIndex+` ON network_observations (`+primaryKeyList+`)`); err != nil {
		return fmt.Errorf("migrate: build primary key index: %w", err)
	}

	return pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SET LOCAL lock_timeout = '30s'`); err != nil {
			return err
		}
		if name != "" {
			if _, err := tx.Exec(ctx, `ALTER TABLE network_observations DROP CONSTRAINT `+pgx.Identifier{name}.Sanitize()); err != nil {
				return fmt.Errorf("migrate: drop old primary key: %w", err)
			}
		}
		if _, err := tx.Exec(ctx, `ALTER TABLE network_observations ADD CONSTRAINT network_observations_pkey PRIMARY KEY USING INDEX `+newPrimaryKeyIndex); err != nil {
			return fmt.Errorf("migrate: install primary key: %w", err)
		}
		return nil
	})
}

func currentPrimaryKey(ctx context.Context, conn *pgxpool.Conn) (string, []string, error) {
	var name string
	var columns []string
	err := conn.QueryRow(ctx, `
		SELECT c.conname, array_agg(a.attname::text ORDER BY k.ord)
		FROM pg_constraint c
		CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
		JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
		WHERE c.conrelid = 'network_observations'::regclass AND c.contype = 'p'
		GROUP BY c.conname`).Scan(&name, &columns)
	if err == pgx.ErrNoRows {
		return "", nil, nil
	}
	return name, columns, err
}

// acquireMigrationLock polls instead of blocking in pg_advisory_lock: a session waiting
// inside that call holds a snapshot, and CREATE INDEX CONCURRENTLY in the lock holder
// would wait for it, which Postgres reports as a deadlock.
func acquireMigrationLock(ctx context.Context, conn *pgxpool.Conn) error {
	for {
		var acquired bool
		if err := conn.QueryRow(ctx, `SELECT pg_try_advisory_lock($1)`, migrationLockKey).Scan(&acquired); err != nil {
			return err
		}
		if acquired {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(250 * time.Millisecond):
		}
	}
}
