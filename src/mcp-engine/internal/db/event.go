package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/util"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
)

type SessionEventType uint8

const (
	SessionEventTypeOutput SessionEventType = 0
	SessionEventTypeError  SessionEventType = 1
	SessionEventTypeLog    SessionEventType = 2
)

func (s SessionEventType) ToPb() managerPb.EngineSessionEventType {
	switch s {
	case SessionEventTypeOutput:
		return managerPb.EngineSessionEventType_session_event_type_output
	case SessionEventTypeError:
		return managerPb.EngineSessionEventType_session_event_type_error
	case SessionEventTypeLog:
		return managerPb.EngineSessionEventType_session_event_type_log
	default:
		return managerPb.EngineSessionEventType_session_event_type_unknown
	}
}

type SessionEvent struct {
	ID string `gorm:"primaryKey;type:uuid;not null"`

	Type SessionEventType `gorm:"type:smallint;not null"`

	SessionID string   `gorm:"type:uuid;not null"`
	Session   *Session `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	RunID sql.NullString `gorm:"type:uuid"`
	Run   *SessionRun    `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

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
		ID:        util.Must(uuid.NewV7()).String(),
		Type:      SessionEventTypeError,
		SessionID: err.SessionID,
		Session:   err.Session,
		RunID:     err.RunID,
		Run:       err.Run,
		ErrorID:   sql.NullString{String: err.ID, Valid: true},
		Error:     err,
		Content:   sql.NullString{},
		Metadata:  make(map[string]string),
	}
}

func NewOutputEvent(session *Session, connection *SessionRun, output *mcp.McpOutput) *SessionEvent {
	return &SessionEvent{
		ID:        util.Must(uuid.NewV7()).String(),
		Type:      SessionEventTypeOutput,
		SessionID: session.ID,
		Session:   session,
		RunID:     sql.NullString{String: connection.ID, Valid: connection != nil},
		Run:       connection,
		Lines:     output.Lines,
	}
}

func (e *SessionEvent) ToPb() (*managerPb.EngineSessionEvent, error) {
	var ses *managerPb.EngineSession
	if e.Session != nil {
		var err error
		ses, err = e.Session.ToPb()
		if err != nil {
			return nil, err
		}
	}

	var conn *managerPb.EngineSessionRun
	if e.Run != nil {
		var err error
		conn, err = e.Run.ToPb()
		if err != nil {
			return nil, err
		}
	}

	var errPb *managerPb.EngineSessionError
	if e.Error != nil {
		var err error
		errPb, err = e.Error.ToPb()
		if err != nil {
			return nil, err
		}
	}

	return &managerPb.EngineSessionEvent{
		Id:        e.ID,
		SessionId: e.SessionID,
		RunId:     e.RunID.String,
		ErrorId:   e.ErrorID.String,

		Type:    e.Type.ToPb(),
		Run:     conn,
		Session: ses,
		Error:   errPb,

		Content:  e.Content.String,
		Lines:    e.Lines,
		Metadata: e.Metadata,

		CreatedAt: e.CreatedAt.Unix(),
	}, nil
}
