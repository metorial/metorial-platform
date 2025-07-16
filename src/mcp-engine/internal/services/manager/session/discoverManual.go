package session

import (
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mt-error"
)

func discoverManual(
	sessions *Sessions,
	connectionInput *workers.WorkerConnectionInput,
	server *db.Server,
) (*db.Server, *mterror.MTError) {
	connection, _, err := createConnection(sessions.workerManager, connectionInput, nil, connectionInput.WorkerType)
	if err != nil {
		return nil, err
	}

	err2 := connection.Start(false)
	if err2 != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to start connection", err2)
	}

	err2 = discoverServer(sessions.db, server, connection)
	if err2 != nil {
		return nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to discover server", err2)
	}

	return server, nil
}
