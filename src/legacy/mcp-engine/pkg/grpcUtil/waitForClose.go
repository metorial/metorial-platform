package grpc_util

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
)

func WaitForConnectionClose(conn *grpc.ClientConn) {
	for {
		state := conn.GetState()

		if state == connectivity.Shutdown {
			return
		}

		if !conn.WaitForStateChange(context.Background(), state) {
			return
		}
	}
}
