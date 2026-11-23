package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/aggregate"
	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/issue"
)

const (
	maxConnections = 4
	deleteChunk    = 500
)

type Options struct {
	Database DatabaseConfig
	// MaxGroups caps the stored groups; new groups beyond it are counted in the per-component
	// overflow group.
	MaxGroups int
}

type Store struct {
	pool      *pgxpool.Pool
	maxGroups int
}

func Open(ctx context.Context, opts Options) (*Store, error) {
	if err := opts.Database.Validate(); err != nil {
		return nil, err
	}
	if err := ensureDatabase(ctx, opts.Database); err != nil {
		return nil, fmt.Errorf("ensure database: %w", err)
	}

	config, err := pgxpool.ParseConfig(opts.Database.DSN())
	if err != nil {
		return nil, err
	}
	config.MaxConns = maxConnections
	config.ConnConfig.RuntimeParams["timezone"] = "UTC"
	config.ConnConfig.RuntimeParams["application_name"] = "error-collector"

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	store := &Store{pool: pool, maxGroups: opts.MaxGroups}
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

// Flush adds drained groups to the database in one transaction, so a failed flush can be restored
// into the aggregator without double counting. A group's latest sample is replaced at most hourly so
// a frequent error doesn't rewrite its JSON on every flush.
func (s *Store) Flush(ctx context.Context, groups []*aggregate.Group) error {
	if len(groups) == 0 {
		return nil
	}

	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		capped, err := s.capGroups(ctx, tx, groups)
		if err != nil {
			return err
		}

		ids, err := upsertGroups(ctx, tx, capped)
		if err != nil {
			return err
		}

		if err := upsertBuckets(ctx, tx, capped, ids); err != nil {
			return err
		}
		return upsertReleases(ctx, tx, capped, ids)
	})
}

// capGroups never mutates its input: overflow groups are fresh copies, so the caller can restore
// the original groups when the transaction fails.
func (s *Store) capGroups(ctx context.Context, tx pgx.Tx, groups []*aggregate.Group) ([]*aggregate.Group, error) {
	hashes := make([]string, 0, len(groups))
	for _, group := range groups {
		hashes = append(hashes, group.Hash)
	}

	existing := map[string]bool{}
	rows, err := tx.Query(ctx, `SELECT hash FROM error_group WHERE hash = ANY($1)`, hashes)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var hash string
		if err := rows.Scan(&hash); err != nil {
			return nil, err
		}
		existing[hash] = true
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var stored int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM error_group`).Scan(&stored); err != nil {
		return nil, err
	}
	capacity := s.maxGroups - stored

	ordered := append([]*aggregate.Group(nil), groups...)
	sort.SliceStable(ordered, func(i, j int) bool { return ordered[i].Count > ordered[j].Count })

	result := make([]*aggregate.Group, 0, len(ordered))
	overflow := map[string]*aggregate.Group{}
	for _, group := range ordered {
		isOverflow := group.Type == aggregate.OverflowType
		if !isOverflow && (existing[group.Hash] || capacity > 0) {
			if !existing[group.Hash] {
				capacity--
			}
			result = append(result, group)
			continue
		}

		if target, ok := overflow[group.Component]; ok {
			aggregate.Merge(target, group)
		} else {
			overflow[group.Component] = aggregate.AsOverflow(group)
		}
	}
	for _, group := range overflow {
		result = append(result, group)
	}

	// A consistent row order keeps concurrent replicas from deadlocking on each other's upserts.
	sort.Slice(result, func(i, j int) bool { return result[i].Hash < result[j].Hash })
	return result, nil
}

func upsertGroups(ctx context.Context, tx pgx.Tx, groups []*aggregate.Group) (map[string]int64, error) {
	var (
		hashes, components, levels, types, values, culprits []string
		firstSeen, lastSeen                                 []time.Time
		counts                                              []int64
		firstSamples, latestSamples                         []pgtype.Text
	)

	for _, group := range groups {
		firstSample, err := sampleJSON(group.FirstSample)
		if err != nil {
			return nil, err
		}
		latestSample, err := sampleJSON(group.LatestSample)
		if err != nil {
			return nil, err
		}

		hashes = append(hashes, group.Hash)
		components = append(components, group.Component)
		levels = append(levels, group.Level)
		types = append(types, group.Type)
		values = append(values, group.Value)
		culprits = append(culprits, group.Culprit)
		firstSeen = append(firstSeen, group.FirstSeen)
		lastSeen = append(lastSeen, group.LastSeen)
		counts = append(counts, group.Count)
		firstSamples = append(firstSamples, firstSample)
		latestSamples = append(latestSamples, latestSample)
	}

	rows, err := tx.Query(ctx, `
		INSERT INTO error_group AS g (
			hash, grouping_version, component, level, type, value, culprit,
			first_seen, last_seen, total_count, first_sample, latest_sample, latest_sample_at
		)
		SELECT
			hash, $12, component, level, type, value, culprit,
			first_seen, last_seen, total_count, first_sample::jsonb, latest_sample::jsonb,
			CASE WHEN latest_sample IS NULL THEN NULL ELSE last_seen END
		FROM unnest(
			$1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
			$7::timestamptz[], $8::timestamptz[], $9::bigint[], $10::text[], $11::text[]
		) AS input (
			hash, component, level, type, value, culprit,
			first_seen, last_seen, total_count, first_sample, latest_sample
		)
		ON CONFLICT (hash) DO UPDATE SET
			total_count = g.total_count + EXCLUDED.total_count,
			first_seen = LEAST(g.first_seen, EXCLUDED.first_seen),
			last_seen = GREATEST(g.last_seen, EXCLUDED.last_seen),
			level = CASE WHEN EXCLUDED.last_seen >= g.last_seen THEN EXCLUDED.level ELSE g.level END,
			value = CASE WHEN EXCLUDED.last_seen >= g.last_seen THEN EXCLUDED.value ELSE g.value END,
			culprit = CASE
				WHEN EXCLUDED.culprit <> '' AND EXCLUDED.last_seen >= g.last_seen THEN EXCLUDED.culprit
				ELSE g.culprit
			END,
			first_sample = COALESCE(g.first_sample, EXCLUDED.first_sample),
			latest_sample = CASE
				WHEN EXCLUDED.latest_sample IS NOT NULL
					AND (g.latest_sample_at IS NULL OR EXCLUDED.latest_sample_at >= g.latest_sample_at + interval '1 hour')
				THEN EXCLUDED.latest_sample
				ELSE g.latest_sample
			END,
			latest_sample_at = CASE
				WHEN EXCLUDED.latest_sample IS NOT NULL
					AND (g.latest_sample_at IS NULL OR EXCLUDED.latest_sample_at >= g.latest_sample_at + interval '1 hour')
				THEN EXCLUDED.latest_sample_at
				ELSE g.latest_sample_at
			END
		RETURNING id, hash`,
		hashes, components, levels, types, values, culprits,
		firstSeen, lastSeen, counts, firstSamples, latestSamples, issue.GroupingVersion,
	)
	if err != nil {
		return nil, fmt.Errorf("upsert groups: %w", err)
	}

	ids := make(map[string]int64, len(groups))
	for rows.Next() {
		var (
			id   int64
			hash string
		)
		if err := rows.Scan(&id, &hash); err != nil {
			return nil, err
		}
		ids[hash] = id
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("upsert groups: %w", err)
	}
	return ids, nil
}

func sampleJSON(sample *issue.Sample) (pgtype.Text, error) {
	if sample == nil {
		return pgtype.Text{}, nil
	}
	encoded, err := json.Marshal(sample)
	if err != nil {
		return pgtype.Text{}, err
	}
	return pgtype.Text{String: string(encoded), Valid: true}, nil
}

type bucketRow struct {
	groupID int64
	at      time.Time
	count   int64
}

func upsertBuckets(ctx context.Context, tx pgx.Tx, groups []*aggregate.Group, ids map[string]int64) error {
	var hourly, daily []bucketRow
	for _, group := range groups {
		id := ids[group.Hash]
		days := map[time.Time]int64{}
		for hour, count := range group.Hours {
			hourly = append(hourly, bucketRow{groupID: id, at: hour.UTC(), count: count})
			days[hour.UTC().Truncate(24*time.Hour)] += count
		}
		for day, count := range days {
			daily = append(daily, bucketRow{groupID: id, at: day, count: count})
		}
	}

	if err := upsertBucketTable(ctx, tx, "error_group_hourly", "hour", hourly); err != nil {
		return err
	}
	return upsertBucketTable(ctx, tx, "error_group_daily", "day", daily)
}

func upsertBucketTable(ctx context.Context, tx pgx.Tx, table, column string, rows []bucketRow) error {
	if len(rows) == 0 {
		return nil
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].groupID != rows[j].groupID {
			return rows[i].groupID < rows[j].groupID
		}
		return rows[i].at.Before(rows[j].at)
	})

	groupIDs := make([]int64, len(rows))
	buckets := make([]time.Time, len(rows))
	counts := make([]int64, len(rows))
	for i, row := range rows {
		groupIDs[i], buckets[i], counts[i] = row.groupID, row.at, row.count
	}

	query := fmt.Sprintf(`
		INSERT INTO %[1]s AS b (group_id, %[2]s, count)
		SELECT group_id, bucket, count
		FROM unnest($1::bigint[], $2::timestamptz[], $3::bigint[]) AS input (group_id, bucket, count)
		ON CONFLICT (group_id, %[2]s) DO UPDATE SET count = b.count + EXCLUDED.count`,
		table, column,
	)
	if _, err := tx.Exec(ctx, query, groupIDs, buckets, counts); err != nil {
		return fmt.Errorf("upsert %s: %w", table, err)
	}
	return nil
}

func upsertReleases(ctx context.Context, tx pgx.Tx, groups []*aggregate.Group, ids map[string]int64) error {
	type releaseRow struct {
		groupID int64
		release string
		counts  *aggregate.ReleaseCount
	}

	var rows []releaseRow
	for _, group := range groups {
		for release, counts := range group.Releases {
			rows = append(rows, releaseRow{groupID: ids[group.Hash], release: release, counts: counts})
		}
	}
	if len(rows) == 0 {
		return nil
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].groupID != rows[j].groupID {
			return rows[i].groupID < rows[j].groupID
		}
		return rows[i].release < rows[j].release
	})

	var (
		groupIDs            []int64
		releases            []string
		counts              []int64
		firstSeen, lastSeen []time.Time
	)
	for _, row := range rows {
		groupIDs = append(groupIDs, row.groupID)
		releases = append(releases, row.release)
		counts = append(counts, row.counts.Count)
		firstSeen = append(firstSeen, row.counts.FirstSeen)
		lastSeen = append(lastSeen, row.counts.LastSeen)
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO error_group_release AS r (group_id, release, count, first_seen, last_seen)
		SELECT * FROM unnest($1::bigint[], $2::text[], $3::bigint[], $4::timestamptz[], $5::timestamptz[])
		ON CONFLICT (group_id, release) DO UPDATE SET
			count = r.count + EXCLUDED.count,
			first_seen = LEAST(r.first_seen, EXCLUDED.first_seen),
			last_seen = GREATEST(r.last_seen, EXCLUDED.last_seen)`,
		groupIDs, releases, counts, firstSeen, lastSeen,
	)
	if err != nil {
		return fmt.Errorf("upsert releases: %w", err)
	}
	return nil
}

type RetentionResult struct {
	Skipped       bool
	HourlyBuckets int64
	DailyBuckets  int64
	Releases      int64
	Groups        int64
}

// Retention deletes in small chunks so it never holds long locks against flushes. Only one replica
// runs it at a time; the others skip.
func (s *Store) Retention(ctx context.Context, now time.Time, hourlyRetention, retention time.Duration) (RetentionResult, error) {
	var result RetentionResult

	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return result, err
	}
	defer conn.Release()

	acquired, err := tryLock(ctx, conn, cleanupLockKey)
	if err != nil {
		return result, err
	}
	if !acquired {
		result.Skipped = true
		return result, nil
	}
	defer func() {
		_, _ = conn.Exec(context.WithoutCancel(ctx), `SELECT pg_advisory_unlock($1)`, cleanupLockKey)
	}()

	hourlyCutoff := now.Add(-hourlyRetention)
	cutoff := now.Add(-retention)

	steps := []struct {
		target *int64
		query  string
		cutoff time.Time
	}{
		{&result.HourlyBuckets, `DELETE FROM error_group_hourly WHERE ctid IN (SELECT ctid FROM error_group_hourly WHERE hour < $1 LIMIT $2)`, hourlyCutoff},
		{&result.DailyBuckets, `DELETE FROM error_group_daily WHERE ctid IN (SELECT ctid FROM error_group_daily WHERE day < $1::date LIMIT $2)`, cutoff},
		{&result.Releases, `DELETE FROM error_group_release WHERE ctid IN (SELECT ctid FROM error_group_release WHERE last_seen < $1 LIMIT $2)`, cutoff},
		{&result.Groups, `DELETE FROM error_group WHERE id IN (SELECT id FROM error_group WHERE last_seen < $1 LIMIT $2)`, cutoff},
	}

	for _, step := range steps {
		for {
			tag, err := conn.Exec(ctx, step.query, step.cutoff, deleteChunk)
			if err != nil {
				return result, fmt.Errorf("retention: %w", err)
			}
			*step.target += tag.RowsAffected()
			if tag.RowsAffected() < deleteChunk {
				break
			}
		}
	}
	return result, nil
}

type Bucket string

const (
	Hourly Bucket = "hour"
	Daily  Bucket = "day"
)

type Query struct {
	Since     time.Time
	Until     time.Time
	Bucket    Bucket
	Component string
	Limit     int
}

func (q Query) validate() error {
	if q.Bucket != Hourly && q.Bucket != Daily {
		return errors.New("unknown bucket")
	}
	if !q.Until.After(q.Since) {
		return errors.New("the query window is empty")
	}
	return nil
}

func (q Query) bucketTable() (string, string) {
	if q.Bucket == Hourly {
		return "error_group_hourly", "hour"
	}
	return "error_group_daily", "day"
}

func (q Query) bucketBounds() (time.Time, time.Time) {
	if q.Bucket == Hourly {
		return q.Since.UTC().Truncate(time.Hour), q.Until.UTC()
	}
	return q.Since.UTC().Truncate(24 * time.Hour), q.Until.UTC()
}

type GroupRecord struct {
	ID              int64
	Hash            string
	GroupingVersion int
	Component       string
	Level           string
	Type            string
	Value           string
	Culprit         string
	FirstSeen       time.Time
	LastSeen        time.Time
	TotalCount      int64
	WindowCount     int64
	FirstSample     json.RawMessage
	LatestSample    json.RawMessage
}

// Groups returns the groups with occurrences in the window: overflow groups first, since they mean
// errors went ungrouped, then the most frequent.
func (s *Store) Groups(ctx context.Context, q Query) ([]GroupRecord, error) {
	if err := q.validate(); err != nil {
		return nil, err
	}

	table, column := q.bucketTable()
	since, until := q.bucketBounds()

	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
		SELECT
			g.id, g.hash, g.grouping_version, g.component, g.level, g.type, g.value, g.culprit,
			g.first_seen, g.last_seen, g.total_count, w.count,
			COALESCE(g.first_sample::text, ''), COALESCE(g.latest_sample::text, '')
		FROM (
			SELECT group_id, sum(count)::bigint AS count
			FROM %[1]s
			WHERE %[2]s >= $1 AND %[2]s < $2
			GROUP BY group_id
		) w
		JOIN error_group g ON g.id = w.group_id
		WHERE $3 = '' OR g.component = $3
		ORDER BY starts_with(g.hash, $5) DESC, w.count DESC, g.last_seen DESC, g.id
		LIMIT $4`, table, column),
		since, until, q.Component, q.Limit, aggregate.OverflowHash(""),
	)
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (GroupRecord, error) {
		var (
			record                    GroupRecord
			firstSample, latestSample string
		)
		err := row.Scan(
			&record.ID, &record.Hash, &record.GroupingVersion, &record.Component, &record.Level,
			&record.Type, &record.Value, &record.Culprit, &record.FirstSeen, &record.LastSeen,
			&record.TotalCount, &record.WindowCount, &firstSample, &latestSample,
		)
		if firstSample != "" {
			record.FirstSample = json.RawMessage(firstSample)
		}
		if latestSample != "" {
			record.LatestSample = json.RawMessage(latestSample)
		}
		return record, err
	})
}

type Point struct {
	GroupID   int64
	Component string
	At        time.Time
	Count     int64
}

// GroupSeries returns the buckets of the given groups in the window.
func (s *Store) GroupSeries(ctx context.Context, q Query, groupIDs []int64) ([]Point, error) {
	if err := q.validate(); err != nil {
		return nil, err
	}
	if len(groupIDs) == 0 {
		return nil, nil
	}

	table, column := q.bucketTable()
	since, until := q.bucketBounds()

	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
		SELECT group_id, %[2]s::timestamptz, count
		FROM %[1]s
		WHERE group_id = ANY($1) AND %[2]s >= $2 AND %[2]s < $3
		ORDER BY group_id, %[2]s`, table, column),
		groupIDs, since, until,
	)
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Point, error) {
		var point Point
		err := row.Scan(&point.GroupID, &point.At, &point.Count)
		return point, err
	})
}

// ComponentSeries returns every group's buckets in the window summed per component, including
// groups beyond a report's issue limit.
func (s *Store) ComponentSeries(ctx context.Context, q Query) ([]Point, error) {
	if err := q.validate(); err != nil {
		return nil, err
	}

	table, column := q.bucketTable()
	since, until := q.bucketBounds()

	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
		SELECT g.component, b.%[2]s::timestamptz, sum(b.count)::bigint
		FROM %[1]s b
		JOIN error_group g ON g.id = b.group_id
		WHERE b.%[2]s >= $1 AND b.%[2]s < $2 AND ($3 = '' OR g.component = $3)
		GROUP BY g.component, b.%[2]s
		ORDER BY g.component, b.%[2]s`, table, column),
		since, until, q.Component,
	)
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (Point, error) {
		var point Point
		err := row.Scan(&point.Component, &point.At, &point.Count)
		return point, err
	})
}

type ReleaseRecord struct {
	GroupID   int64
	Release   string
	Count     int64
	FirstSeen time.Time
	LastSeen  time.Time
}

// Releases returns up to perGroup releases of each group, most recently seen first.
func (s *Store) Releases(ctx context.Context, groupIDs []int64, perGroup int) ([]ReleaseRecord, error) {
	if len(groupIDs) == 0 {
		return nil, nil
	}

	rows, err := s.pool.Query(ctx, `
		SELECT group_id, release, count, first_seen, last_seen
		FROM (
			SELECT *, row_number() OVER (PARTITION BY group_id ORDER BY last_seen DESC, release) AS position
			FROM error_group_release
			WHERE group_id = ANY($1)
		) ranked
		WHERE position <= $2
		ORDER BY group_id, last_seen DESC, release`,
		groupIDs, perGroup,
	)
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (ReleaseRecord, error) {
		var record ReleaseRecord
		err := row.Scan(&record.GroupID, &record.Release, &record.Count, &record.FirstSeen, &record.LastSeen)
		return record, err
	})
}

type ReleaseSummary struct {
	Release   string
	FirstSeen time.Time
	LastSeen  time.Time
}

// ReleaseHistory returns the most recent releases that reported errors, oldest first. A release's
// first_seen is its first error, which usually follows soon after the upgrade.
func (s *Store) ReleaseHistory(ctx context.Context, limit int) ([]ReleaseSummary, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT release, first_seen, last_seen
		FROM (
			SELECT release, min(first_seen) AS first_seen, max(last_seen) AS last_seen
			FROM error_group_release
			GROUP BY release
			ORDER BY min(first_seen) DESC
			LIMIT $1
		) recent
		ORDER BY first_seen, release`,
		limit,
	)
	if err != nil {
		return nil, err
	}

	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (ReleaseSummary, error) {
		var summary ReleaseSummary
		err := row.Scan(&summary.Release, &summary.FirstSeen, &summary.LastSeen)
		return summary, err
	})
}

type Stats struct {
	Groups     int64
	OldestSeen *time.Time
	NewestSeen *time.Time
}

func (s *Store) Stats(ctx context.Context) (Stats, error) {
	var stats Stats
	err := s.pool.QueryRow(ctx, `SELECT count(*), min(first_seen), max(last_seen) FROM error_group`).
		Scan(&stats.Groups, &stats.OldestSeen, &stats.NewestSeen)
	return stats, err
}
