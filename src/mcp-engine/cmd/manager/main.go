package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"

	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/aws"
	"github.com/metorial/metorial/modules/addr"
	sentryUtil "github.com/metorial/metorial/modules/sentry-util"
)

func main() {
	sentryUtil.InitSentryIfNeeded()
	defer sentryUtil.ShutdownSentry()

	managerAddress, workerBrokerAddress, etcdEndpoints, dsn, standaloneWorkers := getConfig()

	db, error := db.NewDB(dsn)
	if error != nil {
		log.Fatalf("Failed to connect to database: %v", error)
	}

	manager, err := manager.NewManager(db, etcdEndpoints, managerAddress, workerBrokerAddress, standaloneWorkers)
	if err != nil {
		log.Fatalf("Failed to create manager: %v", err)
	}

	go manager.Start()

	log.Printf("MCP Manager is running at %s and Worker Broker at %s\n", managerAddress, workerBrokerAddress)

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan

	log.Println("Received interrupt signal, shutting down...")
	if err := manager.Stop(); err != nil {
		log.Printf("Error during shutdown: %v", err)
	}
}

func getConfig() (string, string, []string, string, []manager.StandaloneWorker) {
	addressArg := flag.String("address", "localhost:50050", "Address for the MCP Managers to listen on")
	flag.Parse()

	managerAddress := *addressArg

	managerAddressEnv := os.Getenv("MANAGER_ADDRESS")
	if managerAddressEnv != "" {
		managerAddress = managerAddressEnv
	}

	workerBrokerAddress := os.Getenv("WORKER_BROKER_ADDRESS")
	if workerBrokerAddress == "" {
		workerBrokerAddress = managerAddress
	}

	if os.Getenv("AWS_MODE") == "true" {
		log.Printf("Running in AWS mode, fetching private IP and random port")

		managerPort, err := addr.GetRandomPort()
		if err != nil {
			log.Fatalf("Failed to get random port: %v", err)
		}
		workerBrokerPort, err := addr.GetRandomPort()
		if err != nil {
			log.Fatalf("Failed to get random port: %v", err)
		}

		privateIP, err := aws.GetPrivateIP()
		if err != nil {
			log.Fatalf("Failed to get private IP: %v", err)
		}

		managerAddress = privateIP + ":" + strconv.Itoa(managerPort)
		workerBrokerAddress = privateIP + ":" + strconv.Itoa(workerBrokerPort)
	}

	etcdEndpoints := []string{"http://localhost:2379"}
	etcdEndpointsEnv := os.Getenv("ETCD_ENDPOINTS")
	if etcdEndpointsEnv != "" {
		etcdEndpoints = strings.Split(etcdEndpointsEnv, ",")
	}

	dsn := os.Getenv("ENGINE_DATABASE_DSN")
	if dsn == "" {
		log.Fatal("ENGINE_DATABASE_DSN environment variable is not set")
	}

	standaloneWorkers := make([]manager.StandaloneWorker, 0)

	standaloneRunnerEnv := os.Getenv("STANDALONE_RUNNER")
	if standaloneRunnerEnv != "" {
		standaloneWorkers = append(standaloneWorkers, manager.StandaloneWorker{
			Type:    workers.WorkerTypeContainer,
			Address: standaloneRunnerEnv,
		})
	}

	standaloneLauncherEnv := os.Getenv("STANDALONE_LAUNCHER")
	if standaloneLauncherEnv != "" {
		standaloneWorkers = append(standaloneWorkers, manager.StandaloneWorker{
			Type:    workers.WorkerTypeLauncher,
			Address: standaloneLauncherEnv,
		})
	}

	standaloneRemoteEnv := os.Getenv("STANDALONE_REMOTE")
	if standaloneRemoteEnv != "" {
		standaloneWorkers = append(standaloneWorkers, manager.StandaloneWorker{
			Type:    workers.WorkerTypeRemote,
			Address: standaloneRemoteEnv,
		})
	}

	return managerAddress, workerBrokerAddress, etcdEndpoints, dsn, standaloneWorkers
}
