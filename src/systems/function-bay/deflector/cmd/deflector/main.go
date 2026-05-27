package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/metorial/function-bay-deflector/internal/auth"
	"github.com/metorial/function-bay-deflector/internal/observer"
	"github.com/metorial/function-bay-deflector/internal/proxy"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	addr := os.Getenv("DEFLECTOR_ADDR")
	if addr == "" {
		addr = ":8080"
	}
	jwtSecret := os.Getenv("DEFLECTOR_JWT_SECRET")
	if jwtSecret == "" {
		logger.Error("DEFLECTOR_JWT_SECRET is required")
		os.Exit(1)
	}
	jwtAudience := os.Getenv("DEFLECTOR_JWT_AUDIENCE")
	if jwtAudience == "" {
		jwtAudience = "deflector"
	}

	var recorder *observer.Recorder
	observerIngestURL := os.Getenv("OBSERVER_INGEST_URL")
	if observerIngestURL != "" {
		flushInterval := envDurationSeconds("OBSERVER_FLUSH_INTERVAL_SECONDS", 60*time.Second)
		maxBufferAge := envDurationSeconds("OBSERVER_MAX_BUFFER_AGE_SECONDS", 15*time.Minute)
		recorder = observer.NewRecorder(newInstanceID(), maxBufferAge)
		observerClient := observer.NewClient(observerIngestURL)

		go func() {
			ticker := time.NewTicker(flushInterval)
			defer ticker.Stop()
			for range ticker.C {
				ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
				err := recorder.Flush(ctx, observerClient)
				cancel()
				if err != nil {
					logger.Warn("observer flush failed", "error", err)
				}
			}
		}()
		logger.Info("observer reporting enabled", "url", observerIngestURL, "interval", flushInterval.String())
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           &proxy.Server{Logger: logger, Verifier: auth.NewVerifier(jwtSecret, jwtAudience), Recorder: recorder},
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       90 * time.Second,
		MaxHeaderBytes:    32 << 10,
	}

	logger.Info("starting deflector", "addr", addr)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("deflector exited", "error", err)
		os.Exit(1)
	}
}

func envDurationSeconds(name string, fallback time.Duration) time.Duration {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return fallback
	}
	return time.Duration(seconds) * time.Second
}

func newInstanceID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return hex.EncodeToString(buf)
}
