package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	sentryUtil "github.com/metorial/metorial/modules/sentry-util"
	"github.com/metorial/metorial/services/log/internal/entries"
	"github.com/metorial/metorial/services/log/internal/service"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		// ignore error if .env file is not found
	}

	sentryUtil.InitSentryIfNeeded()
	defer sentryUtil.ShutdownSentry()

	rpcAddress := getEnvOrDefault("LOG_RPC_ADDRESS", ":4071")

	mongoURI := mustGetEnv("LOG_MONGO_URI")
	mongoDb := getEnvOrDefault("LOG_MONGO_DB", "log")

	awsAccessKey := mustGetEnv("LOG_AWS_ACCESS_KEY")
	awsSecretKey := mustGetEnv("LOG_AWS_SECRET_KEY")
	awsRegion := mustGetEnv("LOG_AWS_REGION")
	awsBucket := mustGetEnv("LOG_AWS_S3_BUCKET")
	awsEndpoint := os.Getenv("LOG_AWS_ENDPOINT")

	service := service.NewService(
		context.Background(),
		entries.DefaultEntryTypeRegistry,

		service.WithMongoURI(mongoURI),
		service.WithMongoDatabase(mongoDb),
		service.WithGRPCAddress(rpcAddress),

		service.WithAwsAccessKey(awsAccessKey),
		service.WithAwsSecretKey(awsSecretKey),
		service.WithAwsRegion(awsRegion),
		service.WithS3Bucket(awsBucket),
		service.WithAwsEndpoint(awsEndpoint),
	)

	service.Start()

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	log.Println("Received interrupt signal, shutting down...")
	service.Stop()
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
