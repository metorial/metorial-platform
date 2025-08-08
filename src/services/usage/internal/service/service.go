package service

import (
	"fmt"
	"log"
	"net"

	grpcUtil "github.com/metorial/metorial/mcp-engine/pkg/grpcUtil"
	"github.com/metorial/metorial/services/usage/gen/rpc"
	"github.com/metorial/metorial/services/usage/internal/repository"
	"google.golang.org/grpc/reflection"
)

type Service struct {
	repository *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{
		repository: repo,
	}
}

func (s *Service) Start(rpcAddress string) error {
	rpcService := newUsageService(s.repository)

	// gRPC Server
	grpcServer := grpcUtil.NewGrpcServer("usage")
	rpc.RegisterUsageServiceServer(grpcServer, rpcService)

	reflection.Register(grpcServer)

	lis, err := net.Listen("tcp", rpcAddress)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %v", rpcAddress, err)
	}

	// Start servers
	go func() {
		log.Printf("gRPC server starting on %s\n", rpcAddress)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("gRPC server failed: %v", err)
		}
	}()

	return nil
}

func (s *Service) Stop() error {
	return nil
}
