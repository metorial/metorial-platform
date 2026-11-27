package store

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Installation database URLs may carry Prisma's connection options, which pgx would send to the
// server as runtime parameters (and PostgreSQL rejects).
var prismaOnlyParameters = []string{
	"connection_limit",
	"pool_timeout",
	"pgbouncer",
	"schema",
	"socket_timeout",
	"statement_cache_size",
	"sslaccept",
	"sslidentity",
}

// The installation's sslmode follows node-postgres, where no-verify encrypts without verifying the
// certificate. pgx follows libpq, which calls that require and rejects no-verify (see databaseURL).
type DatabaseConfig struct {
	// URL is the complete database URL. Without it the database Name is used on ServerURL.
	URL       string
	ServerURL string
	Name      string
}

func (c DatabaseConfig) Validate() error {
	if c.URL == "" && c.ServerURL == "" {
		return errors.New("a database URL or a PostgreSQL server URL is required")
	}
	if c.URL == "" && c.Name == "" {
		return errors.New("a database name is required with a server URL")
	}

	_, err := c.databaseURL()
	return err
}

func (c DatabaseConfig) databaseURL() (*url.URL, error) {
	raw := c.URL
	if raw == "" {
		raw = c.ServerURL
	}

	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") {
		return nil, errors.New("the database URL must be a postgres:// URL")
	}

	query := parsed.Query()
	for _, parameter := range prismaOnlyParameters {
		query.Del(parameter)
	}
	if query.Get("sslmode") == "no-verify" {
		query.Set("sslmode", "require")
	}
	parsed.RawQuery = query.Encode()

	if c.URL == "" {
		parsed.Path = "/" + c.Name
		parsed.RawPath = ""
	}
	return parsed, nil
}

func (c DatabaseConfig) DSN() string {
	parsed, err := c.databaseURL()
	if err != nil {
		return ""
	}
	return parsed.String()
}

func (c DatabaseConfig) DatabaseName() string {
	parsed, err := c.databaseURL()
	if err != nil {
		return ""
	}
	return strings.TrimPrefix(parsed.Path, "/")
}

func (c DatabaseConfig) maintenanceDSN() string {
	parsed, err := c.databaseURL()
	if err != nil {
		return ""
	}
	parsed.Path = "/postgres"
	parsed.RawPath = ""
	return parsed.String()
}

// ensureDatabase creates the collector's database on first start, the same way the other services
// get theirs, so an installation needs no manual step. Without CREATEDB the database must exist.
func ensureDatabase(ctx context.Context, cfg DatabaseConfig) error {
	name := cfg.DatabaseName()
	if name == "" {
		return errors.New("the database URL names no database")
	}

	conn, err := pgx.Connect(ctx, cfg.maintenanceDSN())
	if err != nil {
		return err
	}
	defer conn.Close(context.WithoutCancel(ctx))

	var exists bool
	if err := conn.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)`, name).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil
	}

	// Replicas starting together race here; the loser sees 42P04, or 23505 when both inserts
	// reach the catalog at once.
	_, err = conn.Exec(ctx, `CREATE DATABASE `+pgx.Identifier{name}.Sanitize())
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && (pgErr.Code == "42P04" || pgErr.Code == "23505") {
		return nil
	}
	if err != nil {
		return fmt.Errorf("create database %s: %w", name, err)
	}
	return nil
}
