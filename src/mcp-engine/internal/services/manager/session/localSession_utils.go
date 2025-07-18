package session

import (
	"fmt"
	"log"
	"slices"
	"time"

	"github.com/getsentry/sentry-go"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/state"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mtError"
)

const LOCAL_SESSION_INACTIVITY_TIMEOUT = time.Second * 60 * 5

func (s *LocalSession) DiscardSession() *mterror.MTError {
	// The manager is responsible for discarding the session
	err := s.sessionManager.DiscardSession(s.storedSession.ID)
	if err != nil {
		s.CreateStructuredErrorWithRun(
			s.activeRunDb,
			"discard_session_error",
			"failed to discard session",
			map[string]string{
				"internal_error": err.Error(),
			},
		)

		return mterror.NewWithInnerError(mterror.InternalErrorKind, "failed to discard session", err)
	}

	return nil
}

func (s *LocalSession) CanDiscard() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// Never discard a session that has an active connection
	if s.activeConnection != nil {
		return false
	}

	// If the last interaction with the connection was too long ago, we can discard it
	if time.Since(s.lastSessionInteraction) > LOCAL_SESSION_INACTIVITY_TIMEOUT {
		return true
	}

	return false
}

func (s *LocalSession) StoredSession() *state.Session {
	return s.storedSession
}

func (s *LocalSession) SessionRecord() (*db.Session, *mterror.MTError) {
	return s.dbSession, nil
}

func (s *LocalSession) setMcpClient(client *mcp.MCPClient) {
	s.mcpClientInitMutex.Lock()
	defer s.mcpClientInitMutex.Unlock()

	if s.mcpClient != nil {
		return
	}

	if s.dbSession.McpClient == nil {
		if s.mcpServer != nil {
			s.dbSession.McpServer = s.mcpServer
		}

		s.dbSession.McpClient = s.mcpClient
		go s.db.SaveSession(s.dbSession)
	}

	s.mcpClient = client
	s.mcpClientInitWg.Done()
}

func (s *LocalSession) canSendMessage(req *managerPb.StreamMcpMessagesRequest, message *mcp.MCPMessage) bool {
	if req.OnlyIds != nil && !slices.Contains(req.OnlyIds, message.GetStringId()) {
		return false
	}

	if req.OnlyMessageTypes != nil && !slices.Contains(req.OnlyMessageTypes, message.GetPbMessageType()) {
		return false
	}

	return true
}

func (s *LocalSession) stop(type_ SessionStopType) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.activeConnectionCreated.Close()
	s.internalMessages.Close()

	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}

	var dbErr error

	if s.dbSession.Status == db.SessionStatusActive {
		s.dbSession.EndedAt = db.NullTimeNow()

		switch type_ {
		case SessionStopTypeClose:
			s.dbSession.Status = db.SessionStatusClosed
		case SessionStopTypeExpire:
			s.dbSession.Status = db.SessionStatusExpired
		case SessionStopTypeError:
			s.dbSession.Status = db.SessionStatusError
		}

		dbErr = s.db.SaveSession(s.dbSession)
	}

	if s.activeConnection != nil {
		err := s.activeConnection.Close()

		if s.activeRunDb != nil && s.activeRunDb.Status == db.SessionRunStatusActive {
			s.activeRunDb.EndedAt = db.NullTimeNow()
			switch type_ {
			case SessionStopTypeClose:
				s.activeRunDb.Status = db.SessionRunStatusClosed
			case SessionStopTypeExpire:
				s.activeRunDb.Status = db.SessionRunStatusExpired
			case SessionStopTypeError:
				s.activeRunDb.Status = db.SessionRunStatusError
			}

			dbErr = s.db.SaveRun(s.activeRunDb)
		}

		s.activeConnection = nil
		if err != nil {
			sentry.CaptureException(err)
			return fmt.Errorf("failed to close active connection: %w", err)
		}
	}

	if dbErr != nil {
		return fmt.Errorf("failed to save session in database: %w", dbErr)
	}

	return nil
}

func (s *LocalSession) Touch() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.lastSessionInteraction = time.Now()

	if s.dbSession != nil && time.Since(s.dbSession.LastPingAt) > time.Second*60 {
		s.dbSession.LastPingAt = time.Now()
		err := s.db.SaveSession(s.dbSession)
		if err != nil {
			sentry.CaptureException(err)
			log.Printf("Failed to update last ping time for session %s: %v", s.dbSession.ID, err)
		}
	}

	if s.activeRunDb != nil && time.Since(s.activeRunDb.LastPingAt) > time.Second*60 {
		s.activeRunDb.LastPingAt = time.Now()
		err := s.db.SaveRun(s.activeRunDb)
		if err != nil {
			sentry.CaptureException(err)
			log.Printf("Failed to update last ping time for connection %s: %v", s.activeRunDb.ID, err)
		}
	}
}
