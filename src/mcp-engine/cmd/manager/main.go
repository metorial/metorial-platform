package main

import (
	"flag"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/metorial/metorial/mcp-engine/internal/services/manager"
)

func main() {
	rand.Seed(time.Now().UnixNano())

	address, etcdEndpoints := getConfig()

	manager, err := manager.NewManager(etcdEndpoints, address)
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

func getConfig() (string, []string) {
	addressArg := flag.String("address", "localhost:50050", "Address for the MCP Managers to listen on")
	flag.Parse()

	address := *addressArg

	etcdEndpoints := []string{"http://localhost:2379"}
	etcdEndpointsEnv := os.Getenv("ETCD_ENDPOINTS")
	if etcdEndpointsEnv != "" {
		etcdEndpoints = strings.Split(etcdEndpointsEnv, ",")
	}

	return address, etcdEndpoints
}
