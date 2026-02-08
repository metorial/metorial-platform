package db

import (
	"database/sql"
	"fmt"
	"slices"
	"time"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"gorm.io/gorm"
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

	RunID string      `gorm:"type:uuid;not null"`
	Run   *SessionRun `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	MessageType   mcp.MessageType
	MessageMethod sql.NullString `gorm:"type:text"`
	MessageJsonId sql.NullString `gorm:"type:varchar(256)"`
	MessageJson   string         `gorm:"type:text"`

	Metadata map[string]string `gorm:"type:jsonb;serializer:json"`

	CreatedAt time.Time `gorm:"not null"`
}

func NewMessage(session *Session, connection *SessionRun, index int, sender SessionMessageSender, mcpMessage *mcp.MCPMessage) *SessionMessage {
	jsonId := mcpMessage.GetJsonId()

	return &SessionMessage{
		ID:            mcpMessage.GetUuid(),
		SessionID:     session.ID,
		Session:       session,
		RunID:         connection.ID,
		Run:           connection,
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
	sessionIds, err := d.getSessionIdsByExternalId(sessionId)
	if err != nil {
		return nil, err
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

	var conn *managerPb.EngineSessionRun
	if m.Run != nil {
		if m.Run.Session == nil {
			m.Run.Session = m.Session
		}

		var err error
		conn, err = m.Run.ToPb()
		if err != nil {
			return nil, fmt.Errorf("failed to convert Run to PB: %w", err)
		}
	}

	mcpMsg, err := m.ToPbMessage()
	if err != nil {
		return nil, fmt.Errorf("failed to convert SessionMessage to PB: %w", err)
	}

	return &managerPb.EngineSessionMessage{
		Id:         m.ID,
		SessionId:  m.SessionID,
		RunId:      m.RunID,
		Sender:     m.Sender.ToPb(),
		Run:        conn,
		Session:    ses,
		McpMessage: mcpMsg,
		Metadata:   m.Metadata,
		CreatedAt:  m.CreatedAt.UnixMilli(),
	}, nil
}

func (d *DB) ListSessionMessagesBySession(sessionId string, pag *managerPb.ListPagination, after *int64) ([]SessionMessage, error) {
	query := d.db.Model(&SessionMessage{}).Preload("Run").Preload("Session").Where("session_id = ?", sessionId)
	if after != nil {
		query = query.Where("created_at > ?", time.UnixMilli(*after))
	}
	return listWithPagination[SessionMessage](query, pag)
}

func (d *DB) ListSessionMessagesByRun(runId string, pag *managerPb.ListPagination, after *int64) ([]SessionMessage, error) {
	query := d.db.Model(&SessionMessage{}).Preload("Run").Preload("Session").Where("run_id = ?", runId)
	if after != nil {
		query = query.Where("created_at > ?", time.UnixMilli(*after))
	}
	return listWithPagination[SessionMessage](query, pag)
}

func (d *DB) ListSessionMessagesBySessionExternalId(externalId string, pag *managerPb.ListPagination) ([]SessionMessage, error) {
	sessionIds, err := d.getSessionIdsByExternalId(externalId)
	if err != nil {
		return nil, err
	}

	query := d.db.Model(&SessionMessage{}).Preload("Run").Preload("Session").Where("session_id IN ?", sessionIds)
	return listWithPagination[SessionMessage](query, pag)
}

func (d *DB) GetSessionMessageById(id string) (*SessionMessage, error) {
	var record SessionMessage
	err := d.db.Model(&SessionMessage{}).Preload("Run").Preload("Session").Where("id = ?", id).First(&record).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}
	return &record, nil
}
