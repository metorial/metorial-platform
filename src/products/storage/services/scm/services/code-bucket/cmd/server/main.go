package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	codeBucketDoctor "github.com/metorial/metorial/services/code-bucket/internal/doctor"
	"github.com/metorial/metorial/services/code-bucket/internal/service"
	"github.com/metorial/metorial/services/code-bucket/pkg/egress"
	"github.com/metorial/metorial/services/code-bucket/pkg/fs"
	sentryUtil "github.com/metorial/metorial/services/code-bucket/pkg/sentry-util"
	"github.com/metorial/metorial/services/code-bucket/pkg/workspace"
	objectstorage "github.com/metorial/object-storage/clients/go"
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

	allowPrivateNetworks, err := egress.ResolveAllowPrivateNetworks(os.Getenv)
	if err != nil {
		log.Fatalf("Invalid environment: %v", err)
	}
	egress.AllowPrivateNetworks(allowPrivateNetworks)

	fmt.Printf("HTTP Address: %s\n", httpAddress)
	fmt.Printf("RPC Address: %s\n", rpcAddress)
	fmt.Printf("Workspace Address: %s\n", workspaceAddress)
	fmt.Printf("Editor API URL: %s\n", editorApiUrl)
	fmt.Printf("Object Storage Endpoint: %s\n", objectStorageEndpoint)
	fmt.Printf("Object Storage Bucket: %s\n", objectStorageBucket)
	fmt.Printf("Redis URL: %s\n", redisURL)
	fmt.Printf("SCM private networks allowed: %t\n", allowPrivateNetworks)

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
	).WithManifestSourceBuckets(splitList(os.Getenv("ORIGIN_MANIFEST_SOURCE_BUCKETS")))

	doctor, err := codeBucketDoctor.New(codeBucketDoctor.Config{
		Redis:         service.FileSystem().Redis(),
		ObjectStorage: service.FileSystem().ObjectStorage(),
		Bucket:        objectStorageBucket,
		JWTSecret:     jwtSecret,
		EditorAPIURL:  editorApiUrl,
		PublicURL:     os.Getenv("METORIAL_PUBLIC_URL"),
		RPCAddress:    rpcAddress,
		WorkspaceFS:   workspace.GetDistFS,
		WorkspaceDir:  os.TempDir(),
	})
	if err != nil {
		log.Fatalf("Doctor setup failed: %v", err)
	}

	go ensureBucket(service.FileSystem().ObjectStorage(), objectStorageBucket)

	healthAddress := getEnvOrDefault("CODE_BUCKET_HEALTH_ADDRESS", ":12121")
	go serveHealth(healthAddress, doctor.Handler())

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

func serveHealth(address string, doctor http.Handler) {
	mux := http.NewServeMux()
	mux.Handle("/doctor", doctor)
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	log.Printf("Health server starting on %s\n", address)
	if err := http.ListenAndServe(address, mux); err != nil {
		log.Fatalf("Health server failed: %v", err)
	}
}

// The SCM API also creates the bucket when it starts, but code-bucket can start (and run its
// object-storage doctor check) first, so it doesn't wait for that.
func ensureBucket(client *objectstorage.Client, bucket string) {
	for attempt := 1; ; attempt++ {
		_, err := client.UpsertBucket(bucket)
		if err == nil {
			return
		}

		if attempt == 1 || attempt%30 == 0 {
			log.Printf("Creating object storage bucket %s failed, retrying: %v", bucket, err)
		}
		time.Sleep(2 * time.Second)
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

// splitList accepts a comma-separated list or a JSON array, like Origin's list settings.
func splitList(value string) []string {
	var items []string
	if strings.HasPrefix(strings.TrimSpace(value), "[") {
		if err := json.Unmarshal([]byte(value), &items); err != nil {
			log.Fatalf("invalid list %q: %v", value, err)
		}
		return items
	}

	for _, item := range strings.Split(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}
	return items
}
