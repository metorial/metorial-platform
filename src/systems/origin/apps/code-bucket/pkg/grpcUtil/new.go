package grpc_util

import (
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
)

func NewGrpcServer(serviceName string) *grpc.Server {
	grpcServer := grpc.NewServer(grpc.UnaryInterceptor(RecoveryInterceptor))

	healthServer := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	healthServer.SetServingStatus("com.metorial.mcp-engine."+serviceName, grpc_health_v1.HealthCheckResponse_SERVING)

	return grpcServer
}
