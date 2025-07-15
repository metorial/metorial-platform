package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	workerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/worker"
	"github.com/metorial/metorial/mcp-engine/internal/services/worker"
	workerMcpRunner "github.com/metorial/metorial/mcp-engine/internal/services/worker-mcp-runner"
	"github.com/metorial/metorial/mcp-engine/pkg/addr"
	"github.com/metorial/metorial/mcp-engine/pkg/docker"
)

func main() {
	ownAddress, port, managerAddress := getConfig()

	dockerManager := docker.NewDockerManager(docker.RuntimeDocker)
	runner := workerMcpRunner.NewRunner(context.Background(), dockerManager)

	worker, err := worker.NewWorker(context.Background(), workerPb.WorkerType_mcp_runner, ownAddress, managerAddress, runner)
	if err != nil {
		log.Fatalf("Failed to create worker: %v", err)
	}

	log.Printf("Starting MCP Runner on at localhost:%d\n", port)

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	if err := worker.Stop(); err != nil {
		log.Printf("Error stopping worker: %v", err)
	}
}

func getConfig() (string, int, string) {
	ownAddressArg := flag.String("address", "localhost:50051", "Address for the MCP Runner to listen on")
	managerAddressArg := flag.String("manager", "localhost:50050", "Address of the MCP Manager to connect to")
	flag.Parse()

	address := *ownAddressArg
	managerAddress := *managerAddressArg

	addressEnv := os.Getenv("WORKER_ADDRESS")
	if addressEnv != "" {
		address = addressEnv
	}
	managerAddressEnv := os.Getenv("MANAGER_ADDRESS")
	if managerAddressEnv != "" {
		managerAddress = managerAddressEnv
	}

	port, err := addr.ExtractPort(address)
	if err != nil {
		log.Fatalf("Invalid port number: %v", err)
	}

	return address, port, managerAddress
}
