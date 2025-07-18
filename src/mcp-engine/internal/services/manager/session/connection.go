package session

import (
	"fmt"
	"log"

	"github.com/getsentry/sentry-go"
	"github.com/google/uuid"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/util"

	mterror "github.com/metorial/metorial/mcp-engine/pkg/mtError"
)

func createConnection(workerManager *workers.WorkerManager, connectionInput *workers.WorkerConnectionInput, mcpClient *mcp.MCPClient, workerType workers.WorkerType) (workers.WorkerConnection, workers.Worker, *mterror.MTError) {
	// Update the connection input with the session ID and a new connection ID
	connectionInput.ConnectionID = util.Must(uuid.NewV7()).String()
	connectionInput.MCPClient = mcpClient

	hash, err := workerManager.GetConnectionHashForWorkerType(workerType, connectionInput)
	if err != nil {
		sentry.CaptureException(err)

		log.Printf("Failed to get connection hash for worker type %s: %v", workerType, err)
		return nil, nil, mterror.NewWithInnerError(mterror.InternalErrorKind, fmt.Sprintf("failed to get connection hash for worker type: %s", err.Error()), err)
	}

	worker, ok := workerManager.PickWorkerByHash(workerType, hash)
	if !ok {
		log.Printf("No available worker for worker type %s with hash %s", workerType, hash)
		return nil, nil, mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "run_error", "no available worker for worker type", err)
	}

	connection, err := worker.CreateConnection(connectionInput)
	if err != nil {
		sentry.CaptureException(err)

		log.Printf("Failed to create connection for worker %s: %v", worker.WorkerID(), err)
		return nil, nil, mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "run_error", "failed to create connection for worker", err)
	}

	return connection, worker, nil
}
