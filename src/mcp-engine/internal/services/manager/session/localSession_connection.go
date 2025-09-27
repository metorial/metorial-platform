package session

import (
	"log"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mtError"
	"github.com/metorial/metorial/modules/util"
)

func (s *LocalSession) ensureConnection() (workers.WorkerConnection, *db.SessionRun, *mterror.MTError) {
	waitOk := util.WaitTimeout(s.mcpClientInitWg, time.Second*20)
	if !waitOk {
		return nil, nil, mterror.New(mterror.InternalErrorKind, "timeout waiting for MCP client initialization")
	}

	s.mutex.RLock()

	if s.activeConnection != nil {
		s.mutex.RUnlock()
		s.Touch()
		s.lastConnectionInteraction = time.Now()

		return s.activeConnection, s.activeRunDb, nil // Connection already exists
	}

	s.mutex.RUnlock()

	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Double-check if the connection was created while waiting for the lock
	if s.activeConnection != nil {
		return s.activeConnection, s.activeRunDb, nil
	}

	connection, worker, err2 := createConnection(s.workerManager, s.connectionInput, s.mcpClient, s.WorkerType)
	if err2 != nil {
		s.CreateStructuredErrorWithRun(
			s.activeRunDb,
			"run_error",
			"failed to create connection",
			map[string]string{
				"internal_error": err2.Error(),
			},
		)
		return nil, nil, err2
	}

	var connectionType db.SessionRunType
	switch s.WorkerType {
	case workers.WorkerTypeContainer:
		connectionType = db.SessionRunTypeContainer
	case workers.WorkerTypeRemote:
		connectionType = db.SessionRunTypeRemote
	default:
		return nil, nil, mterror.New(mterror.InternalErrorKind, "unsupported worker type for local session")
	}

	run, err := s.db.CreateRun(
		db.NewRun(
			connection.ConnectionID(),
			worker.WorkerID(),
			s.dbSession,
			connectionType,
			db.SessionRunStatusActive,
		),
	)

	s.activeRunDb = run
	if err != nil {
		return nil, nil, mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to create connection in database", err)
	}

	log.Printf("Created connection %s for session %s with worker %s", connection.ConnectionID(), s.storedSession.ID, worker.WorkerID())

	go s.monitorConnection(run, connection)

	err = connection.Start(true)
	if err != nil {
		s.CreateStructuredErrorWithRun(
			run,
			"run_error",
			"failed to start/connect to server",
			map[string]string{
				"internal_error": err.Error(),
			},
		)

		log.Printf("Failed to start connection %s for session %s: %v", connection.ConnectionID(), s.storedSession.ID, err)

		return nil, nil, mterror.NewWithCodeAndInnerError(mterror.InternalErrorKind, "run_error", "failed to start server", err)
	}

	log.Printf("Started connection %s for session %s with worker %s", connection.ConnectionID(), s.storedSession.ID, worker.WorkerID())

	s.activeConnection = connection
	s.lastConnectionInteraction = time.Now()
	s.lastSessionInteraction = time.Now()

	if s.mcpServer == nil {
		go func() {
			if s.dbSession.McpServer == nil {
				server, err := connection.GetServer()
				if err == nil {
					s.dbSession.McpServer = server
					s.dbSession.McpClient = s.mcpClient
					s.db.SaveSession(s.dbSession)
				}
			}

			s.mcpServerInitMutex.Lock()
			defer s.mcpServerInitMutex.Unlock()

			if s.mcpServer != nil {
				return // MCP server already initialized
			}

			server, err2 := connection.GetServer()
			if err2 != nil {
				return
			}

			s.mcpServer = server
		}()
	}

	if (!s.dbSession.Server.LastDiscoveryAt.Valid ||
		time.Since(s.dbSession.Server.LastDiscoveryAt.Time) > time.Hour*24) &&
		s.statefulServerInfo == nil {
		go s.discoverServer(connection)
	}

	defer func() {
		s.activeConnectionCreated.Publish(nil)
	}()

	return connection, run, nil
}

func (s *LocalSession) monitorConnection(run *db.SessionRun, connection workers.WorkerConnection) {
	timeout := connection.InactivityTimeout()

	ticker := time.NewTicker(time.Second * 5)
	defer ticker.Stop()

	doneChan := connection.Done().Subscribe()
	defer connection.Done().Unsubscribe(doneChan)

	errChan := connection.Errors().Subscribe()
	defer connection.Errors().Unsubscribe(errChan)

	msgChan := connection.Messages().Subscribe()
	defer connection.Messages().Unsubscribe(msgChan)

	outChan := connection.Output().Subscribe()
	defer connection.Output().Unsubscribe(outChan)

loop:
	for {
		select {
		case <-ticker.C:
			if time.Since(s.lastConnectionInteraction) > timeout {
				s.mutex.Lock()
				if s.activeConnection != nil && s.activeConnection.ConnectionID() == connection.ConnectionID() {
					s.activeConnection = nil

					if run.Status == db.SessionRunStatusActive {
						run.EndedAt = db.NullTimeNow()
						run.Status = db.SessionRunStatusExpired
						s.db.SaveRun(run)
					}

					go connection.Close()

					log.Printf("Connection %s for session %s has been closed due to inactivity", connection.ConnectionID(), s.storedSession.ID)
				}
				s.mutex.Unlock()

				break loop
			} else if s.activeConnection != nil && s.activeConnection.ConnectionID() != connection.ConnectionID() {
				// I'm pretty sure this can't happen, but just in case
				// clean up the old connection if it has been replaced
				err := connection.Close()
				if err != nil {
					sentry.CaptureException(err)
					log.Printf("Failed to close old connection %s: %v", connection.ConnectionID(), err)
				}

				s.mutex.Lock()
				if run.Status == db.SessionRunStatusActive {
					run.EndedAt = db.NullTimeNow()
					run.Status = db.SessionRunStatusExpired
					s.db.SaveRun(run)
				}
				s.mutex.Unlock()
			}

		case <-doneChan:
			s.mutex.Lock()
			if s.activeConnection != nil && s.activeConnection.ConnectionID() == connection.ConnectionID() {
				s.activeConnection = nil

				if run.Status == db.SessionRunStatusActive {
					run.EndedAt = db.NullTimeNow()

					if s.hasError {
						run.Status = db.SessionRunStatusError
					} else {
						run.Status = db.SessionRunStatusClosed
					}

					s.db.SaveRun(run)
				}
			}
			s.mutex.Unlock()

			break loop

		case err := <-errChan:
			s.hasError = true

			s.CreateMcpError(run, err)

		case message := <-msgChan:
			if strings.HasPrefix(message.GetStringId(), "mte/") {
				// Skip initialization messages, as they are always handled internally
				// and not by the MCP client.
				continue
			}

			go s.PersistMessages(run, db.SessionMessageSenderServer, []*mcp.MCPMessage{message})

		case output := <-outChan:
			go s.db.CreateEvent(
				db.NewOutputEvent(
					s.dbSession,
					run,
					output,
				),
			)

		}
	}

	log.Printf("Connection %s for session %s has been closed", connection.ConnectionID(), s.storedSession.ID)
}

func (s *LocalSession) discoverServer(connection workers.WorkerConnection) {
	s.serverDiscoveryMutex.Lock()
	defer s.serverDiscoveryMutex.Unlock()

	discoverServerWithEphemeralConnection(s.db, s.dbSession.Server, connection)
}
