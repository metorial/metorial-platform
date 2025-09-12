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
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/internal/services/worker"
	workerLauncher "github.com/metorial/metorial/mcp-engine/internal/services/worker-launcher"
	workerMcpRemote "github.com/metorial/metorial/mcp-engine/internal/services/worker-mcp-remote"
	workerMcpRunner "github.com/metorial/metorial/mcp-engine/internal/services/worker-mcp-runner"
	"github.com/metorial/metorial/mcp-engine/pkg/docker"
	sentryUtil "github.com/metorial/metorial/modules/sentry-util"
)

func main() {
	sentryUtil.InitSentryIfNeeded()
	defer sentryUtil.ShutdownSentry()

	err := godotenv.Load()
	if err != nil {
		// ignore error if .env file is not found
	}

	managerAddress := "localhost:50050"

	etcdEndpoints, dsn := getConfig()

	go runManager(managerAddress, etcdEndpoints, dsn)

	timer := time.NewTimer(1 * time.Second)
	<-timer.C

	go runRunner(managerAddress)

	go runLauncher()
	go runRemote()

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

	standaloneWorkers := []manager.StandaloneWorker{
		{Type: workers.WorkerTypeLauncher, Address: "localhost:50052"},
		{Type: workers.WorkerTypeRemote, Address: "localhost:50053"},
	}

	manager, err := manager.NewManager(db, state.Config{
		BackendType: state.BackendEtcd,
		Endpoints:   etcdEndpoints,
		Timeout:     5 * time.Second,
		DialTimeout: 5 * time.Second,
	}, address, address, standaloneWorkers)
	if err != nil {
		log.Fatalf("Failed to create manager: %v", err)
	}

	go func() {
		if err := manager.Start(); err != nil {
			log.Panicf("Manager exited with error: %v", err)
		}
	}()

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

func runLauncher() {
	runner := workerLauncher.NewLauncher()

	worker, err := worker.NewWorker(context.Background(), workerPb.WorkerType_launcher, "localhost:50052", "", runner)
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

func runRemote() {
	remote := workerMcpRemote.NewRemote()

	worker, err := worker.NewWorker(context.Background(), workerPb.WorkerType_mcp_remote, "localhost:50053", "", remote)
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
