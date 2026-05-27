package main

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/metorial/function-bay-deflector/internal/auth"
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

	srv := &http.Server{
		Addr:              addr,
		Handler:           &proxy.Server{Logger: logger, Verifier: auth.NewVerifier(jwtSecret, jwtAudience)},
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
