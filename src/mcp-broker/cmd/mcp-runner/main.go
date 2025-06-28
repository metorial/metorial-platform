package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/metorial/metorial/mcp-broker/pkg/docker"
	mcp_runner "github.com/metorial/metorial/mcp-broker/pkg/mcp-runner"
)

func main() {
	port := getConfig()

	dockerManager := docker.NewDockerManager(docker.RuntimeDocker)
	runner := mcp_runner.NewRunner(context.Background(), port, dockerManager)

	go runner.Start()

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	log.Println("State worker is running. Press Ctrl+C to stop.")
	<-sigChan

	log.Println("Received interrupt signal, shutting down...")
	if err := runner.Stop(); err != nil {
		log.Printf("Error during shutdown: %v", err)
	}
}

func getConfig() int {
	portArg := flag.String("port", "50051", "Port for the MCP Runner to listen on")
	flag.Parse()

	port, err := strconv.Atoi(*portArg)
	if err != nil {
		log.Fatalf("Invalid port number: %v", err)
	}

	return port
}
