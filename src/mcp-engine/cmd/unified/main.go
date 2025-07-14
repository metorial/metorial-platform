package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	workerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/worker"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager"
	"github.com/metorial/metorial/mcp-engine/internal/services/worker"
	workerLauncher "github.com/metorial/metorial/mcp-engine/internal/services/worker-launcher"
	workerMcpRemote "github.com/metorial/metorial/mcp-engine/internal/services/worker-mcp-remote"
	workerMcpRunner "github.com/metorial/metorial/mcp-engine/internal/services/worker-mcp-runner"
	"github.com/metorial/metorial/mcp-engine/pkg/docker"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		// ignore error if .env file is not found
	}

	managerAddress := "localhost:50050"

	etcdEndpoints, dsn := getConfig()

	go runManager(managerAddress, etcdEndpoints, dsn)

	timer := time.NewTimer(2 * time.Second)
	<-timer.C

	go runLauncher(managerAddress)
	go runRemote(managerAddress)
	go runRunner(managerAddress)

	log.Println("Unified MCP Engine is running...")

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan
}

func runManager(address string, etcdEndpoints []string, dsn string) {
	db, error := db.NewDB(dsn)
	if error != nil {
		log.Fatalf("Failed to connect to database: %v", error)
	}

	manager, err := manager.NewManager(db, etcdEndpoints, address)
	if err != nil {
		log.Fatalf("Failed to create manager: %v", err)
	}

	go manager.Start()

	log.Printf("MCP Manager is running at %s", address)

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	log.Println("Received interrupt signal, shutting down...")
	if err := manager.Stop(); err != nil {
		log.Printf("Error during shutdown: %v", err)
	}
}

func runLauncher(managerAddress string) {
	runner := workerLauncher.NewLauncher()

	worker, err := worker.NewWorker(context.Background(), workerPb.WorkerType_launcher, "localhost:50052", managerAddress, runner)
	if err != nil {
		log.Fatalf("Failed to create worker: %v", err)
	}

	log.Printf("Starting Launcher on at localhost:50052\n")

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	if err := worker.Stop(); err != nil {
		log.Printf("Error stopping worker: %v", err)
	}
}

func runRemote(managerAddress string) {
	remote := workerMcpRemote.NewRemote()

	worker, err := worker.NewWorker(context.Background(), workerPb.WorkerType_mcp_remote, "localhost:50053", managerAddress, remote)
	if err != nil {
		log.Fatalf("Failed to create worker: %v", err)
	}

	log.Printf("Starting MCP Remote on at localhost:50053\n")

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	if err := worker.Stop(); err != nil {
		log.Printf("Error stopping worker: %v", err)
	}
}

func runRunner(managerAddress string) {
	dockerManager := docker.NewDockerManager(docker.RuntimeDocker)
	runner := workerMcpRunner.NewRunner(context.Background(), dockerManager)

	worker, err := worker.NewWorker(context.Background(), workerPb.WorkerType_mcp_runner, "localhost:50051", managerAddress, runner)
	if err != nil {
		log.Fatalf("Failed to create worker: %v", err)
	}

	log.Printf("Starting MCP Runner on at localhost:50051\n")

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	if err := worker.Stop(); err != nil {
		log.Printf("Error stopping worker: %v", err)
	}
}

func getConfig() ([]string, string) {
	etcdEndpoints := []string{"http://localhost:2379"}
	etcdEndpointsEnv := os.Getenv("ETCD_ENDPOINTS")
	if etcdEndpointsEnv != "" {
		etcdEndpoints = strings.Split(etcdEndpointsEnv, ",")
	}

	dsn := os.Getenv("ENGINE_DATABASE_DSN")
	if dsn == "" {
		log.Fatal("ENGINE_DATABASE_DSN environment variable is not set")
	}

	return etcdEndpoints, dsn
}
