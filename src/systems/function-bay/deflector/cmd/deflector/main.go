package main

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/metorial/function-bay-deflector/internal/proxy"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	addr := os.Getenv("DEFLECTOR_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           &proxy.Server{Logger: logger},
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
