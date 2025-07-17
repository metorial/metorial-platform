package session

import (
	"log"

	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mt-error"
)

func discoverManual(
	sessions *Sessions,
	connectionInput *workers.WorkerConnectionInput,
	server *db.Server,
	force bool,
) (*db.Server, *mterror.MTError) {
	connection, _, err := createConnection(sessions.workerManager, connectionInput, nil, connectionInput.WorkerType)
	if err != nil {
		return nil, err
	}

	defer func() {
		if err := connection.Close(); err != nil {
			log.Printf("Failed to close connection for server %s: %v", server.ID, err)
		}
	}()

	err2 := connection.Start(false)
	if err2 != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to start connection", err2)
	}

	err2 = discoverServer(sessions.db, server, connection, force)
	if err2 != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to discover server", err2)
	}

	return server, nil
}
