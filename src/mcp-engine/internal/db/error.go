package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/util"
)

type SessionError struct {
	ID string `gorm:"primaryKey;type:uuid;not null"`

	SessionID string   `gorm:"type:uuid;not null"`
	Session   *Session `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	ConnectionID sql.NullString     `gorm:"type:uuid"`
	Connection   *SessionConnection `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	ErrorCode    string            `gorm:"type:varchar(64);not null"`
	ErrorMessage string            `gorm:"type:text;not null"`
	McpError     *mcpPb.McpError   `gorm:"type:jsonb;serializer:json"`
	Metadata     map[string]string `gorm:"type:jsonb;serializer:json"`

	CreatedAt time.Time `gorm:"not null"`
}

func NewErrorFromMcp(session *Session, connection *SessionConnection, mcpError *mcpPb.McpError) *SessionError {
	return &SessionError{
		ID: util.Must(uuid.NewV7()).String(),

		SessionID: session.ID,
		Session:   session,

		ConnectionID: sql.NullString{String: connection.ID, Valid: connection != nil},
		Connection:   connection,

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

func NewErrorStructuredErrorWithConnection(session *Session, connection *SessionConnection, errorCode string, errorMessage string, metadata map[string]string) *SessionError {
	if connection == nil {
		return NewErrorStructuredError(session, errorCode, errorMessage, metadata)
	}

	return &SessionError{
		ID: util.Must(uuid.NewV7()).String(),

		SessionID: session.ID,
		Session:   session,

		ConnectionID: sql.NullString{String: connection.ID, Valid: true},
		Connection:   connection,

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

	if sessionError.Connection != nil && !sessionError.Connection.HasError {
		sessionError.Connection.HasError = true
		err = d.SaveConnection(sessionError.Connection)
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
