package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
)

type SessionEventType uint8

const (
	SessionEventTypeOutput SessionEventType = 0
	SessionEventTypeError  SessionEventType = 1
	SessionEventTypeLog    SessionEventType = 2
)

type SessionEvent struct {
	ID string `gorm:"primaryKey;type:uuid;not null"`

	Type SessionEventType `gorm:"type:smallint;not null"`

	SessionID string   `gorm:"type:uuid;not null"`
	Session   *Session `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	ConnectionID sql.NullString     `gorm:"type:uuid"`
	Connection   *SessionConnection `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	ErrorID sql.NullString `gorm:"type:uuid"`
	Error   *SessionError  `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	Content  sql.NullString    `gorm:"type:text"`
	Lines    []string          `gorm:"type:jsonb;serializer:json"`
	Metadata map[string]string `gorm:"type:jsonb;serializer:json"`

	CreatedAt time.Time `gorm:"not null"`
}

func (d *DB) CreateEvent(event *SessionEvent) error {
	event.CreatedAt = time.Now()
	return d.db.Create(event).Error
}

func newErrorEvent(err *SessionError) *SessionEvent {
	return &SessionEvent{
		ID:           uuid.NewString(),
		Type:         SessionEventTypeError,
		SessionID:    err.SessionID,
		Session:      err.Session,
		ConnectionID: err.ConnectionID,
		Connection:   err.Connection,
		ErrorID:      sql.NullString{String: err.ID, Valid: true},
		Error:        err,
		Content:      sql.NullString{},
		Metadata:     make(map[string]string),
	}
}

func NewOutputEvent(session *Session, connection *SessionConnection, output *mcp.McpOutput) *SessionEvent {
	return &SessionEvent{
		ID:           uuid.NewString(),
		Type:         SessionEventTypeOutput,
		SessionID:    session.ID,
		Session:      session,
		ConnectionID: sql.NullString{String: connection.ID, Valid: connection != nil},
		Connection:   connection,
		Lines:        output.Lines,
	}
}
