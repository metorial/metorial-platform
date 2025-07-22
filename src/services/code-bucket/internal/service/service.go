package service

import (
	"fmt"
	"log"
	"net"
	"net/http"

	grpcUtil "github.com/metorial/metorial/mcp-engine/pkg/grpcUtil"
	"github.com/metorial/metorial/services/code-bucket/gen/rpc"
	"github.com/metorial/metorial/services/code-bucket/pkg/fs"
	"google.golang.org/grpc/reflection"
)

type Service struct {
	fsm       *fs.FileSystemManager
	jwtSecret []byte
}

func NewService(jwtSecret string, opts ...fs.FileSystemManagerOption) *Service {
	fsm := fs.NewFileSystemManager(opts...)

	return &Service{
		fsm:       fsm,
		jwtSecret: []byte(jwtSecret),
	}
}

func (s *Service) Start(httpAddress, rpcAddress string) error {
	httpRouter := newHttpServiceRouter(s)
	rpcService := newRcpService(s)

	httpServer := &http.Server{
		Addr:    httpAddress,
		Handler: httpRouter,
	}

	// gRPC Server
	grpcServer := grpcUtil.NewGrpcServer("code-bucket")
	rpc.RegisterCodeBucketServer(grpcServer, rpcService)

	reflection.Register(grpcServer)

	lis, err := net.Listen("tcp", rpcAddress)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %v", rpcAddress, err)
	}

	// Start servers
	go func() {
		log.Printf("HTTP server starting on %s\n", httpAddress)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server failed: %v", err)
		}
	}()

	go func() {
		log.Printf("gRPC server starting on %s\n", rpcAddress)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("gRPC server failed: %v", err)
		}
	}()

	return nil
}

func (s *Service) Stop() error {
	if s.fsm != nil {
		s.fsm.Close()
	}

	return nil
}
