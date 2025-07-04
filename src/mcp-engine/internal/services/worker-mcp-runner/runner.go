package worker_mcp_runner

import (
	"context"
	"log"
	"time"

	"github.com/metorial/metorial/mcp-engine/internal/services/worker"
	"github.com/metorial/metorial/mcp-engine/pkg/docker"
	"google.golang.org/grpc"

	runnerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/runner"
)

type runner struct {
	worker.WorkerImpl

	worker *worker.Worker

	state *RunnerState
}

func NewRunner(ctx context.Context, dockerManager *docker.DockerManager) *runner {
	state := newRunnerState(dockerManager, ctx.Done())
	state.startPrintStateRoutine(time.Second * 60 * 5)

	log.Println("Runner ID:", state.RunnerID)
	log.Println("Start Time:", state.StartTime)

	return &runner{
		state: state,
	}
}

func (r *runner) Start(worker *worker.Worker, grpc *grpc.Server) error {
	r.worker = worker

	runnerPb.RegisterMcpRunnerServer(grpc, &runnerServer{state: r.state, worker: worker})

	return nil
}

func (r *runner) Stop() error {
	log.Println("Runner stopped successfully")
	return nil
}

func (r *runner) WorkerId() string {
	if r.state == nil {
		return ""
	}
	return r.state.RunnerID
}
