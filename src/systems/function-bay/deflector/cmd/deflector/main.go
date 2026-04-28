package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/metorial/function-bay-deflector/internal/auth"
	"github.com/metorial/function-bay-deflector/internal/proxy"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	keyID := os.Getenv("DEFLECTOR_JWT_KMS_KEY_ID")
	if keyID == "" {
		logger.Error("DEFLECTOR_JWT_KMS_KEY_ID is required")
		os.Exit(1)
	}

	addr := os.Getenv("DEFLECTOR_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	cfg, err := config.LoadDefaultConfig(context.Background())
	if err != nil {
		logger.Error("failed to load aws config", "error", err)
		os.Exit(1)
	}

	verifier := auth.NewVerifier(kms.NewFromConfig(cfg), keyID, os.Getenv("DEFLECTOR_JWT_AUDIENCE"))
	srv := &http.Server{
		Addr:              addr,
		Handler:           &proxy.Server{Verifier: verifier, Logger: logger},
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
