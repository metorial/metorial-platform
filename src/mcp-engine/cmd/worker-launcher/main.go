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
	workerLauncher "github.com/metorial/metorial/mcp-engine/internal/services/worker-launcher"
	"github.com/metorial/metorial/mcp-engine/pkg/aws"
	"github.com/metorial/metorial/modules/addr"
	sentryUtil "github.com/metorial/metorial/modules/sentry-util"
)

func main() {
	sentryUtil.InitSentryIfNeeded()
	defer sentryUtil.ShutdownSentry()

	ownAddress, port, managerAddress := getConfig()

	runner := workerLauncher.NewLauncher()

	worker, err := worker.NewWorker(context.Background(), workerPb.WorkerType_launcher, ownAddress, managerAddress, runner)
	if err != nil {
		log.Fatalf("Failed to create worker: %v", err)
	}

	log.Printf("Starting Launcher on at localhost:%d\n", port)

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	if err := worker.Stop(); err != nil {
		log.Printf("Error stopping worker: %v", err)
	}
}

func getConfig() (string, int, string) {
	ownAddressArg := flag.String("address", "localhost:50052", "Address for the Launcher to listen on")
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

	if os.Getenv("STANDALONE_MODE") == "true" {
		managerAddress = ""
	}

	if os.Getenv("AWS_MODE") == "true" {
		log.Printf("Running in AWS mode, fetching private IP and random port")

		port := os.Getenv("WORKER_PORT")
		if port == "" {
			log.Fatalf("WORKER_PORT environment variable is required in AWS mode")
		}

		privateIP, err := aws.GetPrivateIP()
		if err != nil {
			log.Fatalf("Failed to get private IP: %v", err)
		}

		address = privateIP + ":" + port
	}

	port, err := addr.ExtractPort(address)
	if err != nil {
		log.Fatalf("Invalid port number: %v", err)
	}

	return address, port, managerAddress
}
