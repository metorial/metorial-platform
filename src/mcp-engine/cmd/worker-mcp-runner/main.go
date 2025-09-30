package main

import (
	"context"
	"encoding/base64"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	workerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/worker"
	"github.com/metorial/metorial/mcp-engine/internal/services/worker"
	workerMcpRunner "github.com/metorial/metorial/mcp-engine/internal/services/worker-mcp-runner"
	"github.com/metorial/metorial/mcp-engine/pkg/aws"
	"github.com/metorial/metorial/mcp-engine/pkg/docker"
	"github.com/metorial/metorial/modules/addr"
	sentryUtil "github.com/metorial/metorial/modules/sentry-util"
)

func main() {
	sentryUtil.InitSentryIfNeeded()
	defer sentryUtil.ShutdownSentry()

	ownAddress, port, managerAddress := getConfig()

	config := docker.ImageManagerCreateOptions{}

	externalHostMetorialServiceName := os.Getenv("EXTERNAL_HOST_METORIAL_SERVICE_NAME")
	externalHostMetorialServiceBroker := os.Getenv("EXTERNAL_HOST_METORIAL_SERVICE_BROKER")
	externalHostMetorialListToken := os.Getenv("EXTERNAL_HOST_METORIAL_LIST_TOKEN")
	externalHostPrivateKey := os.Getenv("EXTERNAL_HOST_PRIVATE_KEY")

	if os.Getenv("EXTERNAL_HOST_PRIVATE_KEY_BASE64") != "" {
		decoded, err := base64.StdEncoding.DecodeString(os.Getenv("EXTERNAL_HOST_PRIVATE_KEY_BASE64"))
		if err != nil {
			log.Fatalf("Failed to decode EXTERNAL_HOST_PRIVATE_KEY_BASE64: %v", err)
		}
		externalHostPrivateKey = string(decoded)
	}

	if externalHostMetorialServiceName != "" && externalHostMetorialServiceBroker != "" && externalHostMetorialListToken != "" {
		config.ExternalHostMetorialServiceName = externalHostMetorialServiceName
		config.ExternalHostMetorialServiceBroker = externalHostMetorialServiceBroker
		config.ExternalHostMetorialListToken = externalHostMetorialListToken
		config.ExternalHostPrivateKey = externalHostPrivateKey
	}

	dockerManager := docker.NewDockerManager(docker.RuntimeDocker, config)
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
