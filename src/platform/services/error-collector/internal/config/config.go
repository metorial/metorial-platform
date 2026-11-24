package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/store"
)

const DefaultDatabaseName = "metorial_error_collector"

type Config struct {
	IngestAddress string
	AdminAddress  string
	HealthAddress string

	Database store.DatabaseConfig

	FlushInterval     time.Duration
	RetentionInterval time.Duration
	HourlyRetention   time.Duration
	Retention         time.Duration
	MaxGroups         int
	MaxPendingGroups  int
	MaxConcurrent     int
	MaxBodyBytes      int64
	MaxExpandedBytes  int64
}

type lookup func(string) (string, bool)

func FromEnvironment() (Config, error) {
	return parse(os.LookupEnv)
}

func parse(env lookup) (Config, error) {
	value := func(key, fallback string) string {
		if found, ok := env(key); ok && found != "" {
			return found
		}
		return fallback
	}

	config := Config{
		IngestAddress: value("ERROR_COLLECTOR_INGEST_ADDRESS", ":8095"),
		AdminAddress:  value("ERROR_COLLECTOR_ADMIN_ADDRESS", ":8096"),
		HealthAddress: value("ERROR_COLLECTOR_HEALTH_ADDRESS", ":"+value("HEALTH_PORT", "12121")),
		Database: store.DatabaseConfig{
			URL:       value("ERROR_COLLECTOR_DATABASE_URL", ""),
			ServerURL: value("METORIAL_POSTGRES_URL", value("DATABASE_SERVER_URL", "")),
			Name:      value("ERROR_COLLECTOR_DATABASE_NAME", DefaultDatabaseName),
		},
	}

	var err error
	durations := []struct {
		target   *time.Duration
		key      string
		fallback time.Duration
		minimum  time.Duration
	}{
		{&config.FlushInterval, "ERROR_COLLECTOR_FLUSH_INTERVAL", 10 * time.Second, time.Second},
		{&config.RetentionInterval, "ERROR_COLLECTOR_RETENTION_INTERVAL", time.Hour, time.Minute},
		{&config.HourlyRetention, "ERROR_COLLECTOR_HOURLY_RETENTION", 14 * 24 * time.Hour, time.Hour},
		{&config.Retention, "ERROR_COLLECTOR_RETENTION", 180 * 24 * time.Hour, 24 * time.Hour},
	}
	for _, entry := range durations {
		if *entry.target, err = parseDuration(value(entry.key, ""), entry.fallback, entry.minimum); err != nil {
			return config, fmt.Errorf("%s: %w", entry.key, err)
		}
	}

	var maxGroups, maxPendingGroups, maxConcurrent int64
	integers := []struct {
		target   *int64
		key      string
		fallback int64
	}{
		{&maxGroups, "ERROR_COLLECTOR_MAX_GROUPS", 10000},
		{&maxPendingGroups, "ERROR_COLLECTOR_MAX_PENDING_GROUPS", 5000},
		{&maxConcurrent, "ERROR_COLLECTOR_MAX_CONCURRENT_REQUESTS", 64},
		{&config.MaxBodyBytes, "ERROR_COLLECTOR_MAX_BODY_BYTES", 1 << 20},
		{&config.MaxExpandedBytes, "ERROR_COLLECTOR_MAX_EXPANDED_BYTES", 10 << 20},
	}
	for _, entry := range integers {
		if *entry.target, err = parsePositive(value(entry.key, ""), entry.fallback); err != nil {
			return config, fmt.Errorf("%s: %w", entry.key, err)
		}
	}
	config.MaxGroups = int(maxGroups)
	config.MaxPendingGroups = int(maxPendingGroups)
	config.MaxConcurrent = int(maxConcurrent)

	if config.HourlyRetention > config.Retention {
		config.HourlyRetention = config.Retention
	}
	if err := config.Database.Validate(); err != nil {
		return config, err
	}
	return config, nil
}

// parseDuration accepts Go durations ("90s", "336h") and whole days ("14d").
func parseDuration(raw string, fallback, minimum time.Duration) (time.Duration, error) {
	if raw == "" {
		return fallback, nil
	}

	var (
		parsed time.Duration
		err    error
	)
	if days, ok := strings.CutSuffix(raw, "d"); ok {
		var count int64
		count, err = strconv.ParseInt(days, 10, 64)
		parsed = time.Duration(count) * 24 * time.Hour
	} else {
		parsed, err = time.ParseDuration(raw)
	}
	if err != nil {
		return 0, fmt.Errorf("invalid duration %q", raw)
	}
	if parsed < minimum {
		return 0, fmt.Errorf("must be at least %s", minimum)
	}
	return parsed, nil
}

func parsePositive(raw string, fallback int64) (int64, error) {
	if raw == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("must be a positive integer, got %q", raw)
	}
	return parsed, nil
}
