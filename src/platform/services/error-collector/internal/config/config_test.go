package config

import (
	"strings"
	"testing"
	"time"
)

func env(values map[string]string) lookup {
	return func(key string) (string, bool) {
		value, ok := values[key]
		return value, ok
	}
}

func TestDefaultsUseTheInstallationPostgres(t *testing.T) {
	config, err := parse(env(map[string]string{
		"METORIAL_POSTGRES_URL": "postgres://postgres:secret@postgres:5432/?sslmode=disable&connection_limit=5",
	}))
	if err != nil {
		t.Fatal(err)
	}

	if dsn := config.Database.DSN(); dsn != "postgres://postgres:secret@postgres:5432/metorial_error_collector?sslmode=disable" {
		t.Errorf("dsn = %q", dsn)
	}
	if config.FlushInterval != 10*time.Second || config.HourlyRetention != 14*24*time.Hour || config.MaxGroups != 10000 {
		t.Errorf("defaults = %+v", config)
	}
	if config.IngestAddress != ":8095" || config.AdminAddress != ":8096" || config.HealthAddress != ":12121" {
		t.Errorf("addresses = %s %s %s", config.IngestAddress, config.AdminAddress, config.HealthAddress)
	}
}

func TestExplicitDatabaseURLWins(t *testing.T) {
	config, err := parse(env(map[string]string{
		"ERROR_COLLECTOR_DATABASE_URL":     "postgresql://u:p@localhost:30000/errors_dev",
		"METORIAL_POSTGRES_URL":            "postgres://other@postgres:5432/",
		"ERROR_COLLECTOR_RETENTION":        "30d",
		"ERROR_COLLECTOR_HOURLY_RETENTION": "60d",
	}))
	if err != nil {
		t.Fatal(err)
	}

	if config.Database.DatabaseName() != "errors_dev" || !strings.Contains(config.Database.DSN(), "localhost:30000") {
		t.Errorf("database = %q", config.Database.DSN())
	}
	if config.Retention != 30*24*time.Hour || config.HourlyRetention != config.Retention {
		t.Errorf("retention = %v / %v", config.HourlyRetention, config.Retention)
	}
}

func TestInvalidValues(t *testing.T) {
	cases := []map[string]string{
		{},
		{"METORIAL_POSTGRES_URL": "mysql://x"},
		{"METORIAL_POSTGRES_URL": "postgres://p@h/", "ERROR_COLLECTOR_FLUSH_INTERVAL": "10ms"},
		{"METORIAL_POSTGRES_URL": "postgres://p@h/", "ERROR_COLLECTOR_MAX_GROUPS": "-1"},
		{"METORIAL_POSTGRES_URL": "postgres://p@h/", "ERROR_COLLECTOR_RETENTION": "soon"},
	}
	for _, values := range cases {
		if _, err := parse(env(values)); err == nil {
			t.Errorf("parse(%v) succeeded", values)
		}
	}
}
