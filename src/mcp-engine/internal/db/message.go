package db

import (
	"database/sql"
	"time"

	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
)

type SessionMessageSender int8

const (
	SessionMessageSenderUnknown SessionMessageSender = 0
	SessionMessageSenderClient  SessionMessageSender = 1
	SessionMessageSenderServer  SessionMessageSender = 2
)

type SessionMessage struct {
	ID string `gorm:"primaryKey;type:uuid;not null"`

	Index int `gorm:"type:smallint;not null"`

	Sender SessionMessageSender `gorm:"type:smallint;not null"`

	SessionID string   `gorm:"type:uuid;not null"`
	Session   *Session `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	ConnectionID sql.NullString     `gorm:"type:uuid"`
	Connection   *SessionConnection `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	MessageType   mcp.MessageType
	MessageMethod sql.NullString `gorm:"type:text"`
	MessageJsonId sql.NullString `gorm:"type:varchar(256)"`
	MessageJson   string         `gorm:"type:text"`

	Metadata map[string]string `gorm:"type:jsonb;serializer:json"`

	CreatedAt time.Time `gorm:"not null"`
}

func NewMessage(session *Session, connection *SessionConnection, index int, sender SessionMessageSender, mcpMessage *mcp.MCPMessage) *SessionMessage {
	jsonId := mcpMessage.GetJsonId()

	return &SessionMessage{
		ID:            mcpMessage.GetUuid(),
		SessionID:     session.ID,
		Session:       session,
		ConnectionID:  sql.NullString{String: connection.ID, Valid: connection != nil},
		Connection:    connection,
		Index:         index,
		Sender:        sender,
		MessageType:   mcpMessage.MsgType,
		MessageMethod: sql.NullString{String: mcpMessage.GetMethod(), Valid: mcpMessage.Method != nil},
		MessageJsonId: sql.NullString{String: jsonId, Valid: jsonId != ""},
		MessageJson:   string(mcpMessage.GetRawPayload()),
		Metadata:      make(map[string]string),
		CreatedAt:     time.Now(),
	}
}

func (d *DB) CreateMessage(message *SessionMessage) error {
	message.CreatedAt = time.Now()
	return d.db.Create(message).Error
}
