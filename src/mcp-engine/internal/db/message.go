package db

import (
	"database/sql"
	"fmt"
	"slices"
	"time"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
)

type SessionMessageSender int8

const (
	SessionMessageSenderUnknown SessionMessageSender = 0
	SessionMessageSenderClient  SessionMessageSender = 1
	SessionMessageSenderServer  SessionMessageSender = 2
)

func (s SessionMessageSender) ToPb() managerPb.SessionMessageSender {
	switch s {
	case SessionMessageSenderClient:
		return managerPb.SessionMessageSender_session_message_sender_client
	case SessionMessageSenderServer:
		return managerPb.SessionMessageSender_session_message_sender_server
	default:
		return managerPb.SessionMessageSender_session_message_sender_unknown
	}
}

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

func (d *DB) ListGlobalSessionMessagesAfter(sessionId string, afterId string) ([]SessionMessage, error) {
	two_days_ago := time.Now().Add(-48 * time.Hour)

	var sessions []Session
	err := d.db.Model(&Session{}).
		Where("external_id = ?", sessionId).
		Where("last_ping_at > ?", two_days_ago).
		Find(&sessions).Error
	if err != nil {
		return nil, err
	}

	if len(sessions) == 0 {
		return make([]SessionMessage, 0), nil
	}

	sessionIds := make([]string, 0, len(sessions))
	for _, session := range sessions {
		sessionIds = append(sessionIds, session.ID)
	}

	// We're fetching in reverse order to get the most recent messages first,
	// but we need to reverse them later to return in chronological order.

	var reverseMessages []SessionMessage
	err = d.db.Model(&SessionMessage{}).
		Where("session_id IN ?", sessionIds).
		Where("id > ?", afterId).
		Where("sender = ?", SessionMessageSenderServer).
		Order("created_at DESC").
		Limit(100).
		Find(&reverseMessages).Error
	if err != nil {
		return nil, err
	}

	// Reverse the messages to get them in chronological order
	slices.Reverse(reverseMessages)

	return reverseMessages, nil
}

func (m *SessionMessage) ToMcpMessage() (*mcp.MCPMessage, error) {
	if m == nil {
		return nil, fmt.Errorf("cannot convert nil SessionMessage to MCPMessage")
	}

	msg, err := mcp.ParseMCPMessage(m.ID, m.MessageJson)
	if err != nil {
		return nil, fmt.Errorf("failed to parse MCP message: %w", err)
	}

	msg.MsgType = m.MessageType

	return msg, nil
}

func (m *SessionMessage) ToPbMessage() (*mcpPb.McpMessage, error) {
	mcp, err := m.ToMcpMessage()
	if err != nil {
		return nil, fmt.Errorf("failed to convert SessionMessage to MCPMessage: %w", err)
	}

	return mcp.ToPbMessage(), nil
}

func (m *SessionMessage) ToPbRawMessage() (*mcpPb.McpMessageRaw, error) {
	mcp, err := m.ToMcpMessage()
	if err != nil {
		return nil, fmt.Errorf("failed to convert SessionMessage to MCPMessage: %w", err)
	}

	return mcp.ToPbRawMessage(), nil
}

func (m *SessionMessage) ToPb() (*managerPb.EngineSessionMessage, error) {
	var ses *managerPb.EngineSession
	if m.Session != nil {
		var err error
		ses, err = m.Session.ToPb()
		if err != nil {
			return nil, fmt.Errorf("failed to convert Session to PB: %w", err)
		}
	}

	var conn *managerPb.EngineSessionConnection
	if m.Connection != nil {
		var err error
		conn, err = m.Connection.ToPb()
		if err != nil {
			return nil, fmt.Errorf("failed to convert Connection to PB: %w", err)
		}
	}

	mcpMsg, err := m.ToPbMessage()
	if err != nil {
		return nil, fmt.Errorf("failed to convert SessionMessage to PB: %w", err)
	}

	return &managerPb.EngineSessionMessage{
		Id:           m.ID,
		SessionId:    m.SessionID,
		ConnectionId: m.ConnectionID.String,
		Sender:       m.Sender.ToPb(),
		Connection:   conn,
		Session:      ses,
		McpMessage:   mcpMsg,
		Metadata:     m.Metadata,
		CreatedAt:    m.CreatedAt.UnixMilli(),
	}, nil
}
