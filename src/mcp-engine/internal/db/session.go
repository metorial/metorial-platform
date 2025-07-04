package db

import (
	"database/sql"
	"time"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
)

type SessionStatus uint8

const (
	SessionStatusActive  SessionStatus = 0
	SessionStatusClosed  SessionStatus = 1
	SessionStatusExpired SessionStatus = 2
	SessionStatusError   SessionStatus = 3
)

type SessionType uint8

const (
	SessionTypeUnknown SessionType = 0
	SessionTypeRunner  SessionType = 1
	SessionTypeRemote  SessionType = 2
)

type Session struct {
	ID         string `gorm:"primaryKey;type:uuid;not null"`
	ExternalId string `gorm:"type:varchar(40);not null"`

	Status SessionStatus `gorm:"type:smallint;not null"`
	Type   SessionType   `gorm:"type:smallint;not null"`

	HasError bool `gorm:"default:false;not null"`

	McpClient *mcp.MCPClient `gorm:"type:jsonb;serializer:json;not null"`
	McpServer *mcp.MCPServer `gorm:"type:jsonb;serializer:json"`

	CreatedAt time.Time `gorm:"not null"`
	UpdatedAt time.Time `gorm:"not null"`
	StartedAt time.Time `gorm:"not null"`
	EndedAt   sql.NullTime
}

func NewSession(id string, externalId string, status SessionStatus, type_ SessionType, client *mcp.MCPClient) *Session {
	return &Session{
		ID:         id,
		ExternalId: externalId,

		McpClient: client,

		Status: status,
		Type:   type_,

		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		StartedAt: time.Now(),
	}
}

func SessionTypeFromSessionType(type_ managerPb.CreateSessionRequest_SessionType) SessionType {
	switch type_ {
	case managerPb.CreateSessionRequest_runner:
		return SessionTypeRunner
	default:
		return SessionTypeRemote
	}
}

func (d *DB) CreateSession(session *Session) (*Session, error) {
	session.CreatedAt = time.Now()
	session.UpdatedAt = session.CreatedAt
	session.StartedAt = session.CreatedAt

	return session, d.db.Create(session).Error
}

func (d *DB) SaveSession(session *Session) error {
	session.UpdatedAt = time.Now()
	return d.db.Save(session).Error
}
