package store

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Every replica must use the same keys.
const (
	migrationLockKey int64 = 0x6572726f72636f31
	cleanupLockKey   int64 = 0x6572726f72636f32
)

// migrations are applied in order, each once, recorded in schema_migrations. Never edit an applied
// entry; append a new one.
var migrations = []string{
	`CREATE TABLE error_group (
		id bigserial PRIMARY KEY,
		hash text NOT NULL UNIQUE,
		grouping_version int NOT NULL,
		component text NOT NULL,
		level text NOT NULL,
		type text NOT NULL DEFAULT '',
		value text NOT NULL DEFAULT '',
		culprit text NOT NULL DEFAULT '',
		first_seen timestamptz NOT NULL,
		last_seen timestamptz NOT NULL,
		total_count bigint NOT NULL,
		first_sample jsonb,
		latest_sample jsonb,
		latest_sample_at timestamptz
	);
	CREATE INDEX error_group_last_seen_idx ON error_group (last_seen);

	CREATE TABLE error_group_hourly (
		group_id bigint NOT NULL REFERENCES error_group (id) ON DELETE CASCADE,
		hour timestamptz NOT NULL,
		count bigint NOT NULL,
		PRIMARY KEY (group_id, hour)
	);
	CREATE INDEX error_group_hourly_hour_idx ON error_group_hourly (hour);

	CREATE TABLE error_group_daily (
		group_id bigint NOT NULL REFERENCES error_group (id) ON DELETE CASCADE,
		day date NOT NULL,
		count bigint NOT NULL,
		PRIMARY KEY (group_id, day)
	);
	CREATE INDEX error_group_daily_day_idx ON error_group_daily (day);

	CREATE TABLE error_group_release (
		group_id bigint NOT NULL REFERENCES error_group (id) ON DELETE CASCADE,
		release text NOT NULL,
		count bigint NOT NULL,
		first_seen timestamptz NOT NULL,
		last_seen timestamptz NOT NULL,
		PRIMARY KEY (group_id, release)
	);
	CREATE INDEX error_group_release_last_seen_idx ON error_group_release (last_seen);`,
}

var Tables = []string{"error_group", "error_group_hourly", "error_group_daily", "error_group_release"}

func SchemaVersion() int {
	return len(migrations)
}

func (s *Store) Migrate(ctx context.Context) error {
	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	if err := acquireLock(ctx, conn, migrationLockKey); err != nil {
		return err
	}
	defer func() {
		_, _ = conn.Exec(context.WithoutCancel(ctx), `SELECT pg_advisory_unlock($1)`, migrationLockKey)
	}()

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version int PRIMARY KEY,
		applied_at timestamptz NOT NULL DEFAULT now()
	)`); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	var applied int
	if err := conn.QueryRow(ctx, `SELECT COALESCE(max(version), 0) FROM schema_migrations`).Scan(&applied); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	if applied > len(migrations) {
		return fmt.Errorf("migrate: the database is at schema version %d, newer than this collector (%d); upgrade the collector", applied, len(migrations))
	}

	for version := applied + 1; version <= len(migrations); version++ {
		err := pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
			if _, err := tx.Exec(ctx, migrations[version-1]); err != nil {
				return err
			}
			_, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, version)
			return err
		})
		if err != nil {
			return fmt.Errorf("migrate to version %d: %w", version, err)
		}
	}
	return nil
}

func (s *Store) AppliedSchemaVersion(ctx context.Context) (int, error) {
	var version int
	err := s.pool.QueryRow(ctx, `SELECT COALESCE(max(version), 0) FROM schema_migrations`).Scan(&version)
	return version, err
}

// acquireLock polls instead of blocking in pg_advisory_lock, so a replica waiting for another one's
// migration stays cancellable.
func acquireLock(ctx context.Context, conn *pgxpool.Conn, key int64) error {
	for {
		acquired, err := tryLock(ctx, conn, key)
		if err != nil || acquired {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(250 * time.Millisecond):
		}
	}
}

func tryLock(ctx context.Context, conn *pgxpool.Conn, key int64) (bool, error) {
	var acquired bool
	err := conn.QueryRow(ctx, `SELECT pg_try_advisory_lock($1)`, key).Scan(&acquired)
	return acquired, err
}
