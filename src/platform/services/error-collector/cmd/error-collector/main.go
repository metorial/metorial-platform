package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/aggregate"
	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/config"
	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/server"
	"github.com/metorial/metorial-platform/src/platform/services/error-collector/internal/store"
)

const (
	openRetryInterval = 2 * time.Second
	shutdownTimeout   = 10 * time.Second
	readHeaderTimeout = 10 * time.Second
	requestTimeout    = 30 * time.Second
	reportTimeout     = 2 * time.Minute
)

var version = "dev"

type collector struct {
	config     config.Config
	logger     *log.Logger
	aggregator *aggregate.Aggregator
	store      atomic.Pointer[store.Store]
	admin      atomic.Pointer[http.Handler]
	ui         http.Handler
	status     *status
}

func main() {
	logger := log.New(os.Stderr, "", log.LstdFlags|log.LUTC)

	cfg, err := config.FromEnvironment()
	if err != nil {
		logger.Fatalf("Invalid configuration: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	c := &collector{
		config:     cfg,
		logger:     logger,
		aggregator: aggregate.New(cfg.MaxPendingGroups),
		ui:         server.UIHandler(),
		status:     &status{},
	}

	doctor, err := c.doctor()
	if err != nil {
		logger.Fatalf("Doctor setup failed: %v", err)
	}

	ingest := server.NewIngest(server.IngestOptions{
		Sink:             c.aggregator,
		MaxConcurrent:    cfg.MaxConcurrent,
		MaxBodyBytes:     cfg.MaxBodyBytes,
		MaxExpandedBytes: cfg.MaxExpandedBytes,
		Logger:           logger,
	})

	health := http.NewServeMux()
	health.Handle("/doctor", doctor.Handler())
	health.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})

	servers := []*http.Server{
		newServer(cfg.IngestAddress, http.TimeoutHandler(ingest.Handler(), requestTimeout, "timeout")),
		newServer(cfg.AdminAddress, http.HandlerFunc(c.serveAdmin)),
		newServer(cfg.HealthAddress, health),
	}
	for _, srv := range servers {
		go func() {
			logger.Printf("Listening on %s", srv.Addr)
			if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				logger.Fatalf("Server on %s failed: %v", srv.Addr, err)
			}
		}()
	}

	// Ingest starts before the database is ready: counts wait in memory until the store opens, so
	// components never lose errors to a slow Postgres start.
	go c.open(ctx)
	go c.flushLoop(ctx)
	go c.retentionLoop(ctx)

	<-ctx.Done()
	logger.Printf("Shutting down")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	for _, srv := range servers {
		_ = srv.Shutdown(shutdownCtx)
	}

	if current := c.store.Load(); current != nil {
		c.flush(shutdownCtx, current)
		current.Close()
	}
}

func newServer(address string, handler http.Handler) *http.Server {
	return &http.Server{Addr: address, Handler: handler, ReadHeaderTimeout: readHeaderTimeout}
}

func (c *collector) open(ctx context.Context) {
	for attempt := 1; ; attempt++ {
		opened, err := store.Open(ctx, store.Options{Database: c.config.Database, MaxGroups: c.config.MaxGroups})
		if err == nil {
			c.store.Store(opened)
			c.status.opened()

			var admin http.Handler = server.NewAdmin(server.AdminOptions{
				Source:          opened,
				HourlyRetention: c.config.HourlyRetention,
				Retention:       c.config.Retention,
				Version:         version,
				Logger:          c.logger,
			}).Handler()
			c.admin.Store(&admin)

			c.logger.Printf("Database %s ready at schema version %d", c.config.Database.DatabaseName(), store.SchemaVersion())
			return
		}

		c.status.openFailed(err)
		if attempt == 1 || attempt%30 == 0 {
			c.logger.Printf("Opening the database failed, retrying: %v", err)
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(openRetryInterval):
		}
	}
}

func (c *collector) serveAdmin(w http.ResponseWriter, r *http.Request) {
	admin := c.admin.Load()
	if admin == nil && server.IsUIPath(r.URL.Path) {
		c.ui.ServeHTTP(w, r)
		return
	}
	if admin == nil {
		w.Header().Set("Retry-After", "5")
		http.Error(w, "the error collector is still connecting to its database", http.StatusServiceUnavailable)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), reportTimeout)
	defer cancel()
	(*admin).ServeHTTP(w, r.WithContext(ctx))
}

func (c *collector) flushLoop(ctx context.Context) {
	ticker := time.NewTicker(c.config.FlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if current := c.store.Load(); current != nil {
				c.flush(ctx, current)
			}
		}
	}
}

// flush puts the groups back when the write fails, so a database outage delays counts instead of
// losing them (bounded by the pending group limit).
func (c *collector) flush(ctx context.Context, current *store.Store) {
	groups := c.aggregator.Drain()
	if len(groups) == 0 {
		c.status.flushed(0)
		return
	}

	if err := current.Flush(ctx, groups); err != nil {
		c.aggregator.Restore(groups)
		if c.status.flushFailed(err) {
			c.logger.Printf("Flushing %d error groups failed, keeping them in memory: %v", len(groups), err)
		}
		return
	}

	if c.status.flushed(len(groups)) {
		c.logger.Printf("Flushing works again")
	}
}

func (c *collector) retentionLoop(ctx context.Context) {
	timer := time.NewTimer(time.Minute)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}
		timer.Reset(c.config.RetentionInterval)

		current := c.store.Load()
		if current == nil {
			continue
		}

		result, err := current.Retention(ctx, time.Now(), c.config.HourlyRetention, c.config.Retention)
		if err != nil {
			c.logger.Printf("Retention failed: %v", err)
			continue
		}
		if result.Groups+result.HourlyBuckets+result.DailyBuckets+result.Releases > 0 {
			c.logger.Printf(
				"Retention removed %d groups, %d hourly and %d daily buckets, %d releases",
				result.Groups, result.HourlyBuckets, result.DailyBuckets, result.Releases,
			)
		}
	}
}
