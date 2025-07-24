package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"
	sentryUtil "github.com/metorial/metorial/modules/sentry-util"
	"github.com/metorial/metorial/services/listener/internal/service"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		// ignore error if .env file is not found
	}

	sentryUtil.InitSentryIfNeeded()
	defer sentryUtil.ShutdownSentry()

	rpcAddress := getEnvOrDefault("RPC_ADDRESS", ":4061")
	httpAddress := getEnvOrDefault("HTTP_ADDRESS", ":4060")

	redisUri := mustGetEnv("REDIS_URI")
	jwtSecret := mustGetEnv("JWT_SECRET")

	service := service.NewService(
		service.WithRedisURL(redisUri),
		service.WithGRPCAddress(rpcAddress),
		service.WithWebSocketAddress(httpAddress),
		service.WithJWTSecret(jwtSecret),
	)

	service.Start()

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	log.Println("Received interrupt signal, shutting down...")
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
