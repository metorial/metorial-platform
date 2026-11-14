package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor"
)

func main() {
	cfg, err := supervisor.ConfigFromEnv(os.Environ())
	if err != nil {
		fmt.Fprintf(os.Stderr, "supervisor: invalid configuration: %v\n", err)
		os.Exit(2)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	if err := supervisor.Run(ctx, cfg, os.Stdout); err != nil {
		fmt.Fprintf(os.Stderr, "supervisor: %v\n", err)
		os.Exit(1)
	}
}
