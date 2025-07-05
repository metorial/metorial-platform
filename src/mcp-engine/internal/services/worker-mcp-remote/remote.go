package remote

import (
	"log"

	"github.com/google/uuid"
	"github.com/metorial/metorial/mcp-engine/internal/services/worker"
	"github.com/metorial/metorial/mcp-engine/pkg/util"
	"google.golang.org/grpc"

	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
)

type remote struct {
	worker.WorkerImpl

	id string
}

func NewRemote() *remote {
	return &remote{
		id: util.Must(uuid.NewV7()).String(),
	}
}

func (r *remote) Start(worker *worker.Worker, grpc *grpc.Server) error {
	remotePb.RegisterMcpRemoteServer(grpc, &remoteServer{remote: r, worker: worker})

	return nil
}

func (r *remote) Stop() error {
	log.Println("Runner stopped successfully")
	return nil
}

func (r *remote) WorkerId() string {
	return r.id
}
