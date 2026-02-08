package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/modules/util"
	"gorm.io/gorm"
)

type SessionError struct {
	ID string `gorm:"primaryKey;type:uuid;not null"`

	SessionID string   `gorm:"type:uuid;not null"`
	Session   *Session `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	RunID sql.NullString `gorm:"type:uuid"`
	Run   *SessionRun    `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	ErrorCode    string            `gorm:"type:varchar(64);not null"`
	ErrorMessage string            `gorm:"type:text;not null"`
	McpError     *mcpPb.McpError   `gorm:"type:jsonb;serializer:json"`
	Metadata     map[string]string `gorm:"type:jsonb;serializer:json"`

	CreatedAt time.Time `gorm:"not null"`
}

func NewErrorFromMcp(session *Session, connection *SessionRun, mcpError *mcpPb.McpError) *SessionError {
	return &SessionError{
		ID: util.Must(uuid.NewV7()).String(),

		SessionID: session.ID,
		Session:   session,

		RunID: sql.NullString{String: connection.ID, Valid: connection != nil},
		Run:   connection,

		ErrorCode:    mcpError.ErrorCode.String(),
		ErrorMessage: mcpError.ErrorMessage,
		McpError:     mcpError,

		CreatedAt: time.Now(),
	}
}

func NewErrorStructuredError(session *Session, errorCode string, errorMessage string, metadata map[string]string) *SessionError {
	return &SessionError{
		ID: util.Must(uuid.NewV7()).String(),

		SessionID: session.ID,
		Session:   session,

		ErrorCode:    errorCode,
		ErrorMessage: errorMessage,
		McpError:     nil,
		Metadata:     metadata,

		CreatedAt: time.Now(),
	}
}

func NewErrorStructuredErrorWithRun(session *Session, connection *SessionRun, errorCode string, errorMessage string, metadata map[string]string) *SessionError {
	if connection == nil {
		return NewErrorStructuredError(session, errorCode, errorMessage, metadata)
	}

	return &SessionError{
		ID: util.Must(uuid.NewV7()).String(),

		SessionID: session.ID,
		Session:   session,

		RunID: sql.NullString{String: connection.ID, Valid: true},
		Run:   connection,

		ErrorCode:    errorCode,
		ErrorMessage: errorMessage,
		McpError:     nil,
		Metadata:     metadata,

		CreatedAt: time.Now(),
	}
}

func (d *DB) CreateError(sessionError *SessionError) error {
	sessionError.CreatedAt = time.Now()
	err := d.db.Create(sessionError).Error
	if err != nil {
		return err
	}

	err = d.CreateEvent(newErrorEvent(sessionError))
	if err != nil {
		return err
	}

	if sessionError.Run != nil && !sessionError.Run.HasError {
		sessionError.Run.HasError = true
		err = d.SaveRun(sessionError.Run)
		if err != nil {
			return err
		}
	}

	if sessionError.Session != nil && !sessionError.Session.HasError {
		sessionError.Session.HasError = true
		err = d.SaveSession(sessionError.Session)
		if err != nil {
			return err
		}
	}

	return nil
}

func (e *SessionError) ToPb() (*managerPb.EngineSessionError, error) {
	var err error

	var sessionPb *managerPb.EngineSession
	if e.Session != nil {
		sessionPb, err = e.Session.ToPb()
		if err != nil {
			return nil, err
		}
	}

	var connectionPb *managerPb.EngineSessionRun
	if e.Run != nil {
		if e.Run.Session == nil {
			e.Run.Session = e.Session
		}

		connectionPb, err = e.Run.ToPb()
		if err != nil {
			return nil, err
		}
	}

	return &managerPb.EngineSessionError{
		Id: e.ID,

		SessionId: e.SessionID,
		RunId: func() string {
			if e.RunID.Valid {
				return e.RunID.String
			}
			return ""
		}(),

		Session: sessionPb,
		Run:     connectionPb,

		ErrorCode:    e.ErrorCode,
		ErrorMessage: e.ErrorMessage,
		McpError:     e.McpError,
		Metadata:     e.Metadata,

		CreatedAt: e.CreatedAt.UnixMilli(),
	}, nil
}

func (d *DB) ListSessionErrorsBySession(sessionId string, pag *managerPb.ListPagination, after *int64) ([]SessionError, error) {
	query := d.db.Model(&SessionError{}).Preload("Run").Preload("Session").Where("session_id = ?", sessionId)
	if after != nil {
		query = query.Where("created_at > ?", time.UnixMilli(*after))
	}
	return listWithPagination[SessionError](query, pag)
}

func (d *DB) ListSessionErrorsByRun(runId string, pag *managerPb.ListPagination, after *int64) ([]SessionError, error) {
	query := d.db.Model(&SessionError{}).Preload("Run").Preload("Session").Where("run_id = ?", runId)
	if after != nil {
		query = query.Where("created_at > ?", time.UnixMilli(*after))
	}
	return listWithPagination[SessionError](query, pag)
}

func (d *DB) ListSessionErrorsBySessionExternalId(externalId string, pag *managerPb.ListPagination) ([]SessionError, error) {
	sessionIds, err := d.getSessionIdsByExternalId(externalId)
	if err != nil {
		return nil, err
	}

	query := d.db.Model(&SessionError{}).Preload("Run").Preload("Session").Where("session_id IN ?", sessionIds)
	return listWithPagination[SessionError](query, pag)
}

func (d *DB) GetSessionErrorById(id string) (*SessionError, error) {
	var record SessionError
	err := d.db.Model(&SessionError{}).Preload("Run").Preload("Session").Where("id = ?", id).First(&record).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}
	return &record, nil
}
