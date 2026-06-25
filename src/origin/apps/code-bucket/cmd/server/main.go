package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	"github.com/metorial/metorial/services/code-bucket/internal/service"
	"github.com/metorial/metorial/services/code-bucket/pkg/fs"
	sentryUtil "github.com/metorial/metorial/services/code-bucket/pkg/sentry-util"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		// ignore error if .env file is not found
	}

	sentryUtil.InitSentryIfNeeded()
	defer sentryUtil.ShutdownSentry()

	httpAddress := getEnvOrDefault("CODE_BUCKET_HTTP_ADDRESS", ":52091")
	rpcAddress := getEnvOrDefault("CODE_BUCKET_RPC_ADDRESS", ":5050")
	workspaceAddress := getEnvOrDefault("CODE_BUCKET_WORKSPACE_ADDRESS", ":52092")

	jwtSecret := mustGetEnv("CODE_BUCKET_JWT_SECRET")
	editorApiUrl := getEnvOrDefault("CODE_BUCKET_EDITOR_API_URL", "")
	objectStorageEndpoint := mustGetEnv("CODE_BUCKET_OBJECT_STORAGE_ENDPOINT")
	objectStorageBucket := mustGetEnv("CODE_BUCKET_OBJECT_STORAGE_BUCKET")
	redisURL := os.Getenv("CODE_BUCKET_REDIS_URL")

	fmt.Printf("HTTP Address: %s\n", httpAddress)
	fmt.Printf("RPC Address: %s\n", rpcAddress)
	fmt.Printf("Workspace Address: %s\n", workspaceAddress)
	fmt.Printf("Editor API URL: %s\n", editorApiUrl)
	fmt.Printf("Object Storage Endpoint: %s\n", objectStorageEndpoint)
	fmt.Printf("Object Storage Bucket: %s\n", objectStorageBucket)
	fmt.Printf("Redis URL: %s\n", redisURL)

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

	service := service.NewService(jwtSecret, editorApiUrl,
		fs.WithObjectStorageEndpoint(objectStorageEndpoint),
		fs.WithObjectStorageBucket(objectStorageBucket),
		fs.WithRedisURL(redisURL),
	)

	service.Start(httpAddress, rpcAddress, workspaceAddress)

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
