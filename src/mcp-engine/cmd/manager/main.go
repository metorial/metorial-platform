package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager"
)

func main() {
	address, etcdEndpoints, dsn := getConfig()

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

func getConfig() (string, []string, string) {
	addressArg := flag.String("address", "localhost:50050", "Address for the MCP Managers to listen on")
	flag.Parse()

	address := *addressArg

	etcdEndpoints := []string{"http://localhost:2379"}
	etcdEndpointsEnv := os.Getenv("ETCD_ENDPOINTS")
	if etcdEndpointsEnv != "" {
		etcdEndpoints = strings.Split(etcdEndpointsEnv, ",")
	}

	dsn := os.Getenv("ENGINE_DATABASE_DSN")
	if dsn == "" {
		log.Fatal("ENGINE_DATABASE_DSN environment variable is not set")
	}

	return address, etcdEndpoints, dsn
}
