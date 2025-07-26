package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	sentryUtil "github.com/metorial/metorial/modules/sentry-util"
	mongoStore "github.com/metorial/metorial/services/usage/internal/mongo-store"
	"github.com/metorial/metorial/services/usage/internal/repository"
	"github.com/metorial/metorial/services/usage/internal/service"
)

func main() {
	os.Setenv("TZ", "UTC") // Ensure UTC timezone for consistent timestamps

	err := godotenv.Load()
	if err != nil {
		// ignore error if .env file is not found
	}

	sentryUtil.InitSentryIfNeeded()
	defer sentryUtil.ShutdownSentry()

	rpcAddress := getEnvOrDefault("USAGE_RPC_ADDRESS", "localhost:5050")

	mongoURI := mustGetEnv("USAGE_MONGO_URI")
	mongoDb := getEnvOrDefault("USAGE_MONGO_DB", "usage")
	mongoCollection := getEnvOrDefault("USAGE_MONGO_COLLECTION", "usage_records")

	store, err := mongoStore.NewMongoStore(context.Background(), mongoURI, mongoDb, mongoCollection)
	if err != nil {
		log.Fatalf("Failed to create MongoDB store: %v", err)
	}

	repo := repository.NewRepository(store)

	service := service.NewService(repo)

	service.Start(rpcAddress)

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	log.Println("Received interrupt signal, shutting down...")
	if err := service.Stop(); err != nil {
		log.Printf("Error during shutdown: %v", err)
	}

	if err := store.Close(context.Background()); err != nil {
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

func getEnvOrDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
