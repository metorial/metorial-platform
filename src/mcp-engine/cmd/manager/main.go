package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/aws"
	sentryUtil "github.com/metorial/metorial/modules/sentry-util"
)

func main() {
	sentryUtil.InitSentryIfNeeded()
	defer sentryUtil.ShutdownSentry()

	managerAddress, workerBrokerAddress, stateConfig, dsn, standaloneWorkers := getConfig()

	db, error := db.NewDB(dsn)
	if error != nil {
		log.Fatalf("Failed to connect to database: %v", error)
	}

	manager, err := manager.NewManager(db, stateConfig, managerAddress, workerBrokerAddress, standaloneWorkers)
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

func getConfig() (string, string, state.Config, string, []manager.StandaloneWorker) {
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

		managerPort := os.Getenv("MANAGER_PORT")
		if managerPort == "" {
			log.Fatalf("MANAGER_PORT environment variable is required in AWS mode")
		}
		workerBrokerPort := os.Getenv("WORKER_BROKER_PORT")
		if workerBrokerPort == "" {
			log.Fatalf("WORKER_BROKER_PORT environment variable is required in AWS mode")
		}

		privateIP, err := aws.GetPrivateIP()
		if err != nil {
			log.Fatalf("Failed to get private IP: %v", err)
		}

		managerAddress = privateIP + ":" + managerPort
		workerBrokerAddress = privateIP + ":" + workerBrokerPort
	}

	stateConfig := state.Config{
		BackendType: state.BackendEtcd,
		Timeout:     5 * time.Second,
	}

	etcdEndpointsEnv := os.Getenv("ETCD_ENDPOINTS")
	redisEndpointsEnv := os.Getenv("REDIS_ENDPOINTS")
	if etcdEndpointsEnv != "" {
		stateConfig.BackendType = state.BackendEtcd
		stateConfig.Endpoints = strings.Split(etcdEndpointsEnv, ",")
	} else if redisEndpointsEnv != "" {
		stateConfig.BackendType = state.BackendRedis
		stateConfig.Endpoints = strings.Split(redisEndpointsEnv, ",")

		redisPassword := os.Getenv("REDIS_PASSWORD")
		if redisPassword != "" {
			stateConfig.Password = redisPassword
		}

		redisDbEnv := os.Getenv("REDIS_DB")
		if redisDbEnv != "" {
			redisDb, err := strconv.Atoi(redisDbEnv)
			if err != nil {
				log.Fatalf("Invalid REDIS_DB value: %v", err)
			}
			stateConfig.DB = redisDb
		}
	} else {
		stateConfig.BackendType = state.BackendEtcd
		stateConfig.Endpoints = []string{"http://localhost:2379"}
	}

	dsn := os.Getenv("ENGINE_DATABASE_DSN")
	dbHost := os.Getenv("ENGINE_DB_HOST")
	dbPort := os.Getenv("ENGINE_DB_PORT")
	dbName := os.Getenv("ENGINE_DB_NAME")
	dbUsername := os.Getenv("ENGINE_DB_USERNAME")
	dbPassword := os.Getenv("ENGINE_DB_PASSWORD")
	dbTls := os.Getenv("ENGINE_DB_TLS")
	if dsn == "" && dbHost == "" {
		log.Fatal("ENGINE_DATABASE_DSN environment variable is not set")
	}

	if dbHost != "" && dbPort != "" && dbName != "" && dbUsername != "" && dbPassword != "" {
		sslMode := "disable"
		if dbTls == "true" {
			sslMode = "require"
		}

		dsn = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s", dbHost, dbPort, dbUsername, dbPassword, dbName, sslMode)
		log.Printf("Using database host %s and name %s", dbHost, dbName)
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

	return managerAddress, workerBrokerAddress, stateConfig, dsn, standaloneWorkers
}
