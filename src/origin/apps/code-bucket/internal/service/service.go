package service

import (
	"fmt"
	"log"
	"net"
	"net/http"

	"github.com/metorial/metorial/services/code-bucket/gen/rpc"
	"github.com/metorial/metorial/services/code-bucket/pkg/fs"
	grpcUtil "github.com/metorial/metorial/services/code-bucket/pkg/grpcUtil"
	"github.com/metorial/metorial/services/code-bucket/pkg/workspace"
	"google.golang.org/grpc/reflection"
)

type Service struct {
	fsm             *fs.FileSystemManager
	jwtSecret       []byte
	workspaceServer *workspace.Server
}

func NewService(jwtSecret string, editorApiUrl string, opts ...fs.FileSystemManagerOption) *Service {
	fsm := fs.NewFileSystemManager(opts...)

	// Initialize workspace server
	workspaceServer, err := workspace.NewServer(editorApiUrl)
	if err != nil {
		log.Printf("Warning: Failed to initialize workspace server: %v", err)
		workspaceServer = nil
	}

	return &Service{
		fsm:             fsm,
		jwtSecret:       []byte(jwtSecret),
		workspaceServer: workspaceServer,
	}
}

func (s *Service) Start(httpAddress, rpcAddress, workspaceAddress string) error {
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

	// Start workspace server if available
	if s.workspaceServer != nil {
		go func() {
			log.Printf("Workspace server starting on %s\n", workspaceAddress)
			if err := s.workspaceServer.Start(workspaceAddress); err != nil {
				log.Fatalf("Workspace server failed: %v", err)
			}
		}()
	} else {
		log.Printf("Workspace server disabled (workspace assets not embedded)")
	}

	return nil
}

func (s *Service) Stop() error {
	if s.fsm != nil {
		s.fsm.Close()
	}

	return nil
}
