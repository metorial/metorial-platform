package launcher

import (
	"log"

	"github.com/google/uuid"
	"github.com/metorial/metorial/mcp-engine/internal/services/worker"
	"google.golang.org/grpc"

	launcherPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/launcher"
)

type launcher struct {
	worker.WorkerImpl

	id string
}

func NewLauncher() *launcher {
	return &launcher{
		id: uuid.NewString(),
	}
}

func (r *launcher) Start(worker *worker.Worker, grpc *grpc.Server) error {
	launcherPb.RegisterLauncherServer(grpc, &launcherServer{})

	return nil
}

func (r *launcher) Stop() error {
	log.Println("Runner stopped successfully")
	return nil
}

func (r *launcher) WorkerId() string {
	return r.id
}
