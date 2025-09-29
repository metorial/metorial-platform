package main

import (
	"fmt"
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

	httpAddress := getEnvOrDefault("CODE_BUCKET_HTTP_ADDRESS", ":4040")
	rpcAddress := getEnvOrDefault("CODE_BUCKET_RPC_ADDRESS", ":5050")

	jwtSecret := mustGetEnv("CODE_BUCKET_JWT_SECRET")
	awsBucket := mustGetEnv("CODE_BUCKET_AWS_S3_BUCKET")
	awsRegion := mustGetEnv("CODE_BUCKET_AWS_REGION")
	awsAccessKey := os.Getenv("CODE_BUCKET_AWS_ACCESS_KEY")
	awsSecretKey := os.Getenv("CODE_BUCKET_AWS_SECRET_KEY")
	awsEndpoint := os.Getenv("CODE_BUCKET_AWS_ENDPOINT")
	redisURL := os.Getenv("CODE_BUCKET_REDIS_URL")

	if redisURL == "" {
		redisHost := os.Getenv("REDIS_ENDPOINT")
		redisPort := os.Getenv("REDIS_PORT")
		redisTLS := os.Getenv("REDIS_TLS")
		redisDB := os.Getenv("REDIS_DB")
		redisPassword := os.Getenv("REDIS_PASSWORD")

		redisURL = "redis://"
		if redisTLS == "true" {
			redisURL = "rediss://"
		}
		if redisPassword != "" {
			redisURL += fmt.Sprintf(":%s@", redisPassword)
		}
		redisURL += fmt.Sprintf("%s:%s", redisHost, redisPort)
		if redisDB != "" {
			redisURL += fmt.Sprintf("/%s", redisDB)
		}
	}

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

func getEnvOrDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
