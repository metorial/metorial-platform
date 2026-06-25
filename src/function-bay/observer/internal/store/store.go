package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/metorial/function-bay-observer/internal/api"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Config struct {
	Host     string
	Port     string
	Name     string
	Username string
	Password string
	SSLMode  string
}

type Store struct {
	db    *gorm.DB
	sqlDB *sql.DB
}

type Query struct {
	TenantID        string
	EnclaveIDs      []string
	FunctionIDs     []string
	Hostnames       []string
	IPs             []string
	From            time.Time
	To              time.Time
	IntervalMinutes int
}

type IngestBatch struct {
	ID                  string `gorm:"primaryKey;column:id"`
	DeflectorInstanceID string `gorm:"column:deflector_instance_id;not null"`
	ReceivedAt          int64  `gorm:"column:received_at;not null"`
}

func (IngestBatch) TableName() string {
	return "ingest_batches"
}

type NetworkObservation struct {
	BucketStart         int64  `gorm:"primaryKey;column:bucket_start"`
	TenantID            string `gorm:"primaryKey;column:tenant_id"`
	EnclaveID           string `gorm:"primaryKey;column:enclave_id"`
	FunctionID          string `gorm:"primaryKey;column:function_id"`
	EffectiveFunctionID string `gorm:"primaryKey;column:effective_function_id"`
	Hostname            string `gorm:"primaryKey;column:hostname"`
	IP                  string `gorm:"primaryKey;column:ip"`
	Port                int    `gorm:"primaryKey;column:port"`
	Count               int64  `gorm:"column:count;not null"`
	FirstSeenAt         int64  `gorm:"column:first_seen_at;not null"`
	LastSeenAt          int64  `gorm:"column:last_seen_at;not null"`
}

func (NetworkObservation) TableName() string {
	return "network_observations"
}

func Open(config Config) (*Store, error) {
	if err := config.validate(); err != nil {
		return nil, err
	}
	if err := ensureDatabase(config); err != nil {
		return nil, err
	}

	db, err := gorm.Open(postgres.Open(config.DSN(config.Name)), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(2)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	store := &Store{db: db, sqlDB: sqlDB}
	if err := store.migrate(); err != nil {
		_ = store.Close()
		return nil, err
	}
	return store, nil
}

func (c Config) validate() error {
	if c.Host == "" || c.Port == "" || c.Name == "" || c.Username == "" {
		return errors.New("database host, port, name, and username are required")
	}
	return nil
}

func (c Config) DSN(databaseName string) string {
	values := url.Values{}
	values.Set("sslmode", c.sslMode())
	return (&url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(c.Username, c.Password),
		Host:     net.JoinHostPort(c.Host, c.Port),
		Path:     databaseName,
		RawQuery: values.Encode(),
	}).String()
}

func (c Config) sslMode() string {
	if c.SSLMode == "" {
		return "require"
	}
	return c.SSLMode
}

func ensureDatabase(config Config) error {
	db, err := gorm.Open(postgres.Open(config.DSN("postgres")), &gorm.Config{})
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	defer sqlDB.Close()

	var exists bool
	if err := db.Raw(
		`SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ?)`,
		config.Name,
	).Scan(&exists).Error; err != nil {
		return err
	}
	if exists {
		return nil
	}
	return db.Exec(`CREATE DATABASE ` + quoteIdentifier(config.Name)).Error
}

func quoteIdentifier(identifier string) string {
	return `"` + strings.ReplaceAll(identifier, `"`, `""`) + `"`
}

func (s *Store) Close() error {
	return s.sqlDB.Close()
}

func (s *Store) migrate() error {
	return s.db.AutoMigrate(&IngestBatch{}, &NetworkObservation{})
}

func (s *Store) Ingest(ctx context.Context, batch api.IngestBatch) (bool, error) {
	if batch.ID == "" {
		return false, errors.New("batch id is required")
	}

	inserted := false
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&IngestBatch{
			ID:                  batch.ID,
			DeflectorInstanceID: batch.DeflectorInstanceID,
			ReceivedAt:          time.Now().UTC().Unix(),
		})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return nil
		}
		inserted = true

		for _, record := range batch.Records {
			if err := upsertObservation(tx, record); err != nil {
				return err
			}
		}
		return nil
	})
	return inserted, err
}

func upsertObservation(tx *gorm.DB, record api.Observation) error {
	if record.TenantID == "" || record.FunctionID == "" {
		return errors.New("observation is missing required identity fields")
	}
	if record.Hostname == "" || record.IP == "" || record.Port <= 0 {
		return errors.New("observation is missing destination fields")
	}
	if record.Count <= 0 {
		record.Count = 1
	}

	observation := NetworkObservation{
		BucketStart:         record.BucketStart.UTC().Unix(),
		TenantID:            record.TenantID,
		EnclaveID:           record.EnclaveID,
		FunctionID:          record.FunctionID,
		EffectiveFunctionID: record.EffectiveFunctionID,
		Hostname:            record.Hostname,
		IP:                  record.IP,
		Port:                record.Port,
		Count:               record.Count,
		FirstSeenAt:         record.FirstSeenAt.UTC().Unix(),
		LastSeenAt:          record.LastSeenAt.UTC().Unix(),
	}

	return tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "bucket_start"},
			{Name: "tenant_id"},
			{Name: "enclave_id"},
			{Name: "function_id"},
			{Name: "effective_function_id"},
			{Name: "hostname"},
			{Name: "ip"},
			{Name: "port"},
		},
		DoUpdates: clause.Assignments(map[string]any{
			"count":         gorm.Expr("network_observations.count + EXCLUDED.count"),
			"first_seen_at": gorm.Expr("LEAST(network_observations.first_seen_at, EXCLUDED.first_seen_at)"),
			"last_seen_at":  gorm.Expr("GREATEST(network_observations.last_seen_at, EXCLUDED.last_seen_at)"),
		}),
	}).Create(&observation).Error
}

func (s *Store) Query(ctx context.Context, query Query) ([]api.Observation, error) {
	clauses := []string{"1 = 1"}
	args := []any{}
	intervalSeconds := query.IntervalMinutes * 60
	if intervalSeconds <= 0 {
		intervalSeconds = 30 * 60
	}
	if intervalSeconds < 30*60 || intervalSeconds%(30*60) != 0 {
		return nil, errors.New("interval must be a multiple of 30 minutes")
	}

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
	addListFilter := func(column string, values []string) {
		if len(values) == 0 {
			return
		}
		placeholders := make([]string, 0, len(values))
		for _, value := range values {
			if value == "" {
				continue
			}
			placeholders = append(placeholders, "?")
			args = append(args, value)
		}
		if len(placeholders) == 0 {
			return
		}
		clauses = append(clauses, fmt.Sprintf("%s IN (%s)", column, strings.Join(placeholders, ",")))
	}
	addListFilter("enclave_id", query.EnclaveIDs)
	addListFilter("function_id", query.FunctionIDs)
	addListFilter("hostname", query.Hostnames)
	addListFilter("ip", query.IPs)

	type row struct {
		IntervalStart       int64
		TenantID            string
		EnclaveID           string
		FunctionID          string
		EffectiveFunctionID string
		Hostname            string
		IP                  string
		Port                int
		Count               int64
		FirstSeenAt         int64
		LastSeenAt          int64
	}
	rows := []row{}
	err := s.db.WithContext(ctx).Raw(
		`SELECT
			CAST(bucket_start / ? AS BIGINT) * ? AS interval_start,
			tenant_id,
			enclave_id,
			function_id,
			effective_function_id,
			hostname,
			ip,
			port,
			SUM(count) AS count,
			MIN(first_seen_at) AS first_seen_at,
			MAX(last_seen_at) AS last_seen_at
		FROM network_observations
		WHERE `+strings.Join(clauses, " AND ")+`
		GROUP BY
			interval_start,
			tenant_id,
			enclave_id,
			function_id,
			effective_function_id,
			hostname,
			ip,
			port
		ORDER BY interval_start DESC, last_seen_at DESC
		LIMIT 1000`,
		append([]any{intervalSeconds, intervalSeconds}, args...)...,
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	records := make([]api.Observation, 0, len(rows))
	for _, row := range rows {
		records = append(records, api.Observation{
			BucketStart:         time.Unix(row.IntervalStart, 0).UTC(),
			TenantID:            row.TenantID,
			EnclaveID:           row.EnclaveID,
			FunctionID:          row.FunctionID,
			EffectiveFunctionID: row.EffectiveFunctionID,
			Hostname:            row.Hostname,
			IP:                  row.IP,
			Port:                row.Port,
			Count:               row.Count,
			FirstSeenAt:         time.Unix(row.FirstSeenAt, 0).UTC(),
			LastSeenAt:          time.Unix(row.LastSeenAt, 0).UTC(),
		})
	}
	return records, nil
}

func (s *Store) CleanupBefore(ctx context.Context, cutoff time.Time) (int64, error) {
	var deleted int64
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Where("bucket_start < ?", cutoff.UTC().Unix()).Delete(&NetworkObservation{})
		if res.Error != nil {
			return res.Error
		}
		deleted = res.RowsAffected

		res = tx.Where("received_at < ?", cutoff.UTC().Unix()).Delete(&IngestBatch{})
		return res.Error
	})
	return deleted, err
}
