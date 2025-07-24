package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	sentryUtil "github.com/metorial/metorial/modules/sentry-util"
	"github.com/metorial/metorial/services/code-bucket/internal/service"
	"github.com/metorial/metorial/services/code-bucket/pkg/fs"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		// ignore error if .env file is not found
	}

	sentryUtil.InitSentryIfNeeded()
	defer sentryUtil.ShutdownSentry()

	httpAddress := "localhost:4040"
	rpcAddress := "localhost:5050"

	httpAddressEnv := os.Getenv("HTTP_ADDRESS")
	if httpAddressEnv != "" {
		httpAddress = httpAddressEnv
	}

	rpcAddressEnv := os.Getenv("RPC_ADDRESS")
	if rpcAddressEnv != "" {
		rpcAddress = rpcAddressEnv
	}

	jwtSecret := mustGetEnv("JWT_SECRET")
	awsBucket := mustGetEnv("AWS_S3_BUCKET")
	awsRegion := mustGetEnv("AWS_REGION")
	awsAccessKey := mustGetEnv("AWS_ACCESS_KEY")
	awsSecretKey := mustGetEnv("AWS_SECRET_KEY")
	awsEndpoint := os.Getenv("AWS_ENDPOINT")
	redisURL := os.Getenv("REDIS_URL")

	service := service.NewService(jwtSecret,
		fs.WithAwsAccessKey(awsAccessKey),
		fs.WithAwsSecretKey(awsSecretKey),
		fs.WithAwsRegion(awsRegion),
		fs.WithS3Bucket(awsBucket),
		fs.WithAwsEndpoint(awsEndpoint),
		fs.WithRedisURL(redisURL),
	)

	service.Start(httpAddress, rpcAddress)

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	log.Println("Received interrupt signal, shutting down...")
	if err := service.Stop(); err != nil {
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
