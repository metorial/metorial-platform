package main

import (
	"context"
	"fmt"
	"net/url"
	"sync"
	"time"

	doctor "github.com/metorial/metorial-platform/src/lib/doctor/go"
	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/store"
)

const (
	component        = "error-collector"
	docs             = "datacenter/operations/doctor#error-collector"
	pingWarnLatency  = 250 * time.Millisecond
	flushFailedAfter = time.Minute
)

type statusState struct {
	openError     error
	isOpen        bool
	flushError    error
	failingSince  time.Time
	lastFlush     time.Time
	lastFlushSize int
}

type status struct {
	mu sync.Mutex
	statusState
}

func (s *status) opened() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.isOpen, s.openError = true, nil
}

func (s *status) openFailed(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.openError = err
}

// flushed reports whether the previous flush had failed.
func (s *status) flushed(groups int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	recovered := s.flushError != nil
	s.flushError, s.failingSince = nil, time.Time{}
	s.lastFlush, s.lastFlushSize = time.Now(), groups
	return recovered
}

// flushFailed reports whether this is the first failure in a row.
func (s *status) flushFailed(err error) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	first := s.flushError == nil
	s.flushError = err
	if first {
		s.failingSince = time.Now()
	}
	return first
}

func (s *status) snapshot() statusState {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.statusState
}

func resolution(summary string, steps ...string) *doctor.Resolution {
	link := docs
	return &doctor.Resolution{Summary: summary, Steps: steps, Docs: &link}
}

// Every check is a warning: error reports are a support aid and must never hold the installation
// back.
func (c *collector) doctor() (*doctor.Doctor, error) {
	d := doctor.New(doctor.Options{Component: component, ReleaseVersion: &version})
	target := databaseTarget(c.config.Database)

	err := d.Register(
		doctor.Check{
			ID:       "database.reachable",
			Title:    "Error collector database",
			Category: doctor.CategoryDatabase,
			Severity: doctor.SeverityWarning,
			Target:   target,
			Run: func(ctx context.Context, r *doctor.Result) error {
				current := c.store.Load()
				if current == nil {
					state := c.status.snapshot()
					message := "The error collector has not connected to its database yet."
					details := map[string]any{}
					if state.openError != nil {
						details["error"] = doctor.DescribeError(state.openError)
					}
					r.Warn(message, resolution(
						"The collector creates and migrates its database on start and retries until it can.",
						"Check that PostgreSQL is reachable from the error-collector component.",
						"Check that its user may create databases, or create "+c.config.Database.DatabaseName()+" yourself.",
					), details)
					return nil
				}
				return doctor.Probe("PostgreSQL", current.Ping, pingWarnLatency)(ctx, r)
			},
		},
		doctor.Check{
			ID:        "database.schema",
			Title:     "Error collector schema",
			Category:  doctor.CategoryDatabase,
			Severity:  doctor.SeverityWarning,
			Target:    target,
			DependsOn: []string{"database.reachable"},
			Run: func(ctx context.Context, r *doctor.Result) error {
				current := c.store.Load()
				if current == nil {
					r.Skip("The database is not connected yet.", nil)
					return nil
				}

				applied, err := current.AppliedSchemaVersion(ctx)
				if err != nil {
					return err
				}
				details := map[string]any{"applied": applied, "expected": store.SchemaVersion()}
				if applied != store.SchemaVersion() {
					r.Warn(fmt.Sprintf("The schema is at version %d, this collector expects %d.", applied, store.SchemaVersion()), resolution(
						"Another collector version migrated the database.",
						"Run the same error-collector version on every replica.",
					), details)
					return nil
				}
				r.Pass("The schema is up to date.", details)
				return nil
			},
		},
		doctor.Check{
			ID:       "flush.recent",
			Title:    "Error collector writes",
			Category: doctor.CategoryRuntime,
			Severity: doctor.SeverityWarning,
			Run: func(_ context.Context, r *doctor.Result) error {
				state := c.status.snapshot()
				if !state.isOpen {
					r.Skip("The database is not connected yet.", nil)
					return nil
				}
				if state.flushError != nil && time.Since(state.failingSince) > flushFailedAfter {
					r.Warn("Collected errors could not be written for "+time.Since(state.failingSince).Round(time.Second).String()+".", resolution(
						"Counts are kept in memory and written once the database accepts them again.",
						"Check the error-collector logs for the database error.",
					), map[string]any{"error": doctor.DescribeError(state.flushError)})
					return nil
				}

				details := map[string]any{}
				if !state.lastFlush.IsZero() {
					details["last_flush"] = state.lastFlush.UTC().Format(time.RFC3339)
					details["last_flush_groups"] = state.lastFlushSize
				}
				r.Pass("Collected errors are being written.", details)
				return nil
			},
		},
	)
	return d, err
}

func databaseTarget(cfg store.DatabaseConfig) string {
	parsed, err := url.Parse(cfg.DSN())
	if err != nil {
		return cfg.DatabaseName()
	}
	return parsed.Host + "/" + cfg.DatabaseName()
}
