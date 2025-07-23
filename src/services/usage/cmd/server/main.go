package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	sentryUtil "github.com/metorial/metorial/modules/sentry-util"
	"github.com/metorial/metorial/services/usage/internal/db"
	"github.com/metorial/metorial/services/usage/internal/service"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		// ignore error if .env file is not found
	}

	sentryUtil.InitSentryIfNeeded()
	defer sentryUtil.ShutdownSentry()

	rpcAddress := "localhost:5050"

	rpcAddressEnv := os.Getenv("RPC_ADDRESS")
	if rpcAddressEnv != "" {
		rpcAddress = rpcAddressEnv
	}

	mongoURI := mustGetEnv("MONGO_URI")

	db.Connect(context.Background(), mongoURI)

	service := service.NewService()

	service.Start(rpcAddress)

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	log.Println("Received interrupt signal, shutting down...")
	if err := service.Stop(); err != nil {
		log.Printf("Error during shutdown: %v", err)
	}

	if err := db.Close(context.Background()); err != nil {
		log.Printf("Error during shutdown: %v", err)
	}
}

func mustGetEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("Environment variable %s is required but not set", key)
	}
	return value
}
