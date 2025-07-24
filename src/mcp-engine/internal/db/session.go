package db

import (
	"database/sql"
	"time"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"gorm.io/gorm"
)

type SessionStatus uint8

const (
	SessionStatusActive  SessionStatus = 0
	SessionStatusClosed  SessionStatus = 1
	SessionStatusExpired SessionStatus = 2
	SessionStatusError   SessionStatus = 3
)

func (s SessionStatus) ToPb() managerPb.EngineSessionStatus {
	switch s {
	case SessionStatusActive:
		return managerPb.EngineSessionStatus_session_status_active
	case SessionStatusClosed:
		return managerPb.EngineSessionStatus_session_status_closed
	case SessionStatusExpired:
		return managerPb.EngineSessionStatus_session_status_expired
	case SessionStatusError:
		return managerPb.EngineSessionStatus_session_status_error
	default:
		return managerPb.EngineSessionStatus_session_status_unknown
	}
}

type SessionType uint8

const (
	SessionTypeUnknown   SessionType = 0
	SessionTypeContainer SessionType = 1
	SessionTypeRemote    SessionType = 2
)

func (s SessionType) ToPb() managerPb.EngineSessionType {
	switch s {
	case SessionTypeContainer:
		return managerPb.EngineSessionType_session_type_container
	case SessionTypeRemote:
		return managerPb.EngineSessionType_session_type_remote
	default:
		return managerPb.EngineSessionType_session_type_unknown
	}
}

type Session struct {
	ID         string `gorm:"primaryKey;type:uuid;not null"`
	ExternalId string `gorm:"type:varchar(40);not null;index"`

	Status SessionStatus `gorm:"type:smallint;not null;index"`
	Type   SessionType   `gorm:"type:smallint;not null"`

	HasError bool `gorm:"default:false;not null"`

	McpClient *mcp.MCPClient `gorm:"type:jsonb;serializer:json"`
	McpServer *mcp.MCPServer `gorm:"type:jsonb;serializer:json"`

	CreatedAt  time.Time `gorm:"not null"`
	UpdatedAt  time.Time `gorm:"not null"`
	StartedAt  time.Time `gorm:"not null"`
	LastPingAt time.Time `gorm:"not null"`

	ServerID string  `gorm:"type:uuid;not null"`
	Server   *Server `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	McpVersion string `gorm:"type:varchar(50);not null;default:'2024-11-05'"`

	Metadata map[string]string `gorm:"type:jsonb;serializer:json"`

	EndedAt sql.NullTime
}

func NewSession(id string, externalId string, server *Server, status SessionStatus, type_ SessionType, client *mcp.MCPClient, mcpVersion string, metadata map[string]string) *Session {
	return &Session{
		ID:         id,
		ExternalId: externalId,

		McpClient:  client,
		McpVersion: mcpVersion,

		Server:   server,
		ServerID: server.ID,

		Status: status,
		Type:   type_,

		Metadata: metadata,

		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
		StartedAt:  time.Now(),
		LastPingAt: time.Now(),
	}
}

func (d *DB) CreateSession(session *Session) (*Session, error) {
	session.CreatedAt = time.Now()
	session.UpdatedAt = session.CreatedAt
	session.StartedAt = session.CreatedAt
	session.LastPingAt = session.CreatedAt

	if session.Metadata == nil {
		session.Metadata = make(map[string]string)
	}

	return session, d.db.Create(session).Error
}

func (d *DB) SaveSession(session *Session) error {
	session.UpdatedAt = time.Now()
	session.LastPingAt = time.Now()

	if session.Status == SessionStatusError {
		session.HasError = true
	}

	if session.Metadata == nil {
		session.Metadata = make(map[string]string)
	}

	return d.db.Save(session).Error
}

func (d *DB) expireActiveSessionsRoutine() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		d.db.Model(&Session{}).
			Where("status = ? AND last_ping_at < ?", SessionStatusActive, now.Add(-5*time.Minute)).
			Update("status", SessionStatusExpired)
	}
}

func (d *DB) cleanupOldSessionsRoutine() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		d.db.Model(&Session{}).
			Where("status = ? AND ended_at < ?", SessionStatusExpired, now.Add(-30*24*time.Hour)).
			Delete(&Session{})
	}
}

func (s *Session) ToPb() (*managerPb.EngineSession, error) {
	var clientPart *mcpPb.McpParticipant
	if s.McpClient != nil {
		var err error
		clientPart, err = s.McpClient.ToPbParticipant()
		if err != nil {
			return nil, err
		}
	}

	var serverPart *mcpPb.McpParticipant
	if s.McpServer != nil {
		var err error
		serverPart, err = s.McpServer.ToPbParticipant()
		if err != nil {
			return nil, err
		}
	}

	var server *managerPb.EngineServer
	if s.Server != nil {
		var err error
		server, err = s.Server.ToPb()
		if err != nil {
			return nil, err
		}
	}

	return &managerPb.EngineSession{
		Id:         s.ID,
		ExternalId: s.ExternalId,

		Status:   s.Status.ToPb(),
		Type:     s.Type.ToPb(),
		HasError: s.HasError,

		McpClient: clientPart,
		McpServer: serverPart,

		Server: server,

		CreatedAt:  s.CreatedAt.UnixMilli(),
		UpdatedAt:  s.UpdatedAt.UnixMilli(),
		StartedAt:  s.StartedAt.UnixMilli(),
		LastPingAt: s.LastPingAt.UnixMilli(),
		EndedAt: func() int64 {
			if s.EndedAt.Valid {
				return s.EndedAt.Time.UnixMilli()
			}
			return 0
		}(),

		McpConfig: &mcpPb.McpConfig{
			McpVersion: s.McpVersion,
		},
	}, nil
}

func (d *DB) ListSessionsByExternalId(externalId string, pag *managerPb.ListPagination) ([]Session, error) {
	query := d.db.Model(&Session{}).Preload("Server").Where("external_id = ?", externalId)
	return listWithPagination[Session](query, pag)
}

func (d *DB) GetSessionById(id string) (*Session, error) {
	var session Session
	err := d.db.Model(&Session{}).Preload("Server").Where("id = ?", id).First(&session).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}
	return &session, nil
}

func (d *DB) getSessionIdsByExternalId(externalId string) ([]string, error) {
	var sessions []Session
	err := d.db.Model(&Session{}).Select("id").Where("external_id = ?", externalId).Find(&sessions).Error
	if err != nil {
		return nil, err
	}

	ids := make([]string, len(sessions))
	for i, session := range sessions {
		ids[i] = session.ID
	}
	return ids, nil
}

func (d *DB) ListRecentlyActiveSessions(since time.Time) ([]string, error) {
	var sessions []Session
	err := d.db.Model(&Session{}).
		Where("last_ping_at >= ? or updated_at >= ?", since, since).
		Select("id").
		Find(&sessions).Error
	if err != nil {
		return nil, err
	}

	ids := make([]string, len(sessions))
	for i, session := range sessions {
		ids[i] = session.ID
	}
	return ids, nil
}
