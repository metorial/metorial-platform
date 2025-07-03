package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/metorial/metorial/mcp-engine/pkg/addr"
	"github.com/metorial/metorial/mcp-engine/pkg/docker"
	mcp_runner "github.com/metorial/metorial/mcp-engine/pkg/mcp-runner"
	"github.com/metorial/metorial/mcp-engine/pkg/worker"
)

func main() {
	ownAddress, port, managerAddress := getConfig()

	dockerManager := docker.NewDockerManager(docker.RuntimeDocker)
	runner := mcp_runner.NewRunner(context.Background(), port, dockerManager)

	worker, err := worker.NewWorker(context.Background(), runner.RunnerId(), ownAddress, managerAddress, runner)
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

	port, err := addr.ExtractPort(address)
	if err != nil {
		log.Fatalf("Invalid port number: %v", err)
	}

	return address, port, managerAddress
}
