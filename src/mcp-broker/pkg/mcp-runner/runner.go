package mcp_runner

import (
	"context"
	"log"
	"net"
	"strconv"
	"time"

	"github.com/metorial/metorial/mcp-broker/pkg/docker"
	pb "github.com/metorial/metorial/mcp-broker/pkg/proto-mcp-runner"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type runner struct {
	port int

	state      *RunnerState
	server     *runnerServer
	grpcServer *grpc.Server
}

func NewRunner(ctx context.Context, port int, dockerManager *docker.DockerManager) *runner {
	done := make(chan struct{})

	state := newRunnerState(dockerManager, done)
	state.startPrintStateRoutine(time.Second * 10)

	log.Println("Runner ID:", state.RunnerID)
	log.Println("Start Time:", state.StartTime)

	return &runner{
		port:   port,
		state:  state,
		server: &runnerServer{state: state},
	}
}

func (r *runner) Start() error {
	address := ":" + strconv.Itoa(r.port)

	lis, err := net.Listen("tcp", address)
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	s := grpc.NewServer()
	r.grpcServer = s

	pb.RegisterMcpRunnerServer(s, r.server)

	reflection.Register(s)

	log.Printf("Starting manager server at %s", address)

	if err := s.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}

	return nil
}

func (r *runner) Stop() error {
	if r.server != nil {
		r.grpcServer.Stop()
	}

	log.Println("Runner stopped successfully")
	return nil
}
