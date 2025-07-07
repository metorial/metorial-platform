package db

import (
	"database/sql"
	"time"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	"gorm.io/gorm"
)

type SessionConnectionType uint8

const (
	SessionConnectionTypeRemote SessionConnectionType = 0
	SessionConnectionTypeRunner SessionConnectionType = 1
)

func (s SessionConnectionType) ToPb() managerPb.EngineConnectionType {
	switch s {
	case SessionConnectionTypeRemote:
		return managerPb.EngineConnectionType_connection_type_remote
	case SessionConnectionTypeRunner:
		return managerPb.EngineConnectionType_connection_type_runner
	default:
		return managerPb.EngineConnectionType_connection_type_unknown
	}
}

type SessionConnectionStatus uint8

const (
	SessionConnectionStatusActive  SessionConnectionStatus = 0
	SessionConnectionStatusClosed  SessionConnectionStatus = 1
	SessionConnectionStatusExpired SessionConnectionStatus = 2
	SessionConnectionStatusError   SessionConnectionStatus = 3
)

func (s SessionConnectionStatus) ToPb() managerPb.EngineConnectionStatus {
	switch s {
	case SessionConnectionStatusActive:
		return managerPb.EngineConnectionStatus_connection_status_active
	case SessionConnectionStatusClosed:
		return managerPb.EngineConnectionStatus_connection_status_closed
	case SessionConnectionStatusExpired:
		return managerPb.EngineConnectionStatus_connection_status_expired
	case SessionConnectionStatusError:
		return managerPb.EngineConnectionStatus_connection_status_error
	default:
		return managerPb.EngineConnectionStatus_connection_status_unknown
	}
}

type SessionConnection struct {
	ID string `gorm:"primaryKey;type:uuid;not null"`

	SessionID string   `gorm:"type:uuid;not null"`
	Session   *Session `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	Type   SessionConnectionType   `gorm:"type:smallint;not null"`
	Status SessionConnectionStatus `gorm:"type:smallint;not null;index"`

	HasError bool `gorm:"default:false;not null"`

	WorkerID string `gorm:"type:uuid;not null"`

	CreatedAt  time.Time `gorm:"not null"`
	UpdatedAt  time.Time `gorm:"not null"`
	StartedAt  time.Time `gorm:"not null"`
	LastPingAt time.Time `gorm:"not null"`
	EndedAt    sql.NullTime
}

func NewConnection(id string, workerId string, session *Session, type_ SessionConnectionType, status SessionConnectionStatus) *SessionConnection {
	return &SessionConnection{
		ID:        id,
		SessionID: session.ID,
		Session:   session,

		WorkerID: workerId,

		Type:   type_,
		Status: status,

		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
		StartedAt:  time.Now(),
		LastPingAt: time.Now(),
	}
}

func (d *DB) CreateConnection(conn *SessionConnection) (*SessionConnection, error) {
	conn.CreatedAt = time.Now()

	return conn, d.db.Create(conn).Error
}

func (d *DB) SaveConnection(conn *SessionConnection) error {
	conn.UpdatedAt = time.Now()
	return d.db.Save(conn).Error
}

func NullTimeNow() sql.NullTime {
	return sql.NullTime{
		Time:  time.Now(),
		Valid: true,
	}
}

func (d *DB) expireActiveSessionConnectionsRoutine() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		d.db.Model(&SessionConnection{}).
			Where("status = ? AND last_ping_at < ?", SessionConnectionStatusActive, now.Add(-5*time.Minute)).
			Update("status", SessionConnectionStatusExpired)
	}
}

func (c *SessionConnection) ToPb() (*managerPb.EngineSessionConnection, error) {
	ses, err := c.Session.ToPb()
	if err != nil {
		return nil, err
	}

	return &managerPb.EngineSessionConnection{
		Id:         c.ID,
		SessionId:  c.SessionID,
		Type:       c.Type.ToPb(),
		Status:     c.Status.ToPb(),
		HasError:   c.HasError,
		WorkerId:   c.WorkerID,
		CreatedAt:  c.CreatedAt.Unix(),
		UpdatedAt:  c.UpdatedAt.Unix(),
		StartedAt:  c.StartedAt.Unix(),
		LastPingAt: c.LastPingAt.Unix(),
		EndedAt: func() int64 {
			if c.EndedAt.Valid {
				return c.EndedAt.Time.Unix()
			}
			return 0
		}(),
		Session: ses,
	}, nil
}

func (d *DB) ListSessionConnectionsBySession(session *Session, pag *managerPb.ListPagination) ([]SessionConnection, error) {
	query := d.db.Model(&SessionConnection{}).Where("session_id = ?", session.ID)
	return listWithPagination[SessionConnection](query, pag)
}

func (d *DB) ListSessionConnectionsBySessionExternalId(externalId string, pag *managerPb.ListPagination) ([]SessionConnection, error) {
	sessionIds, err := d.getSessionIdsByExternalId(externalId)
	if err != nil {
		return nil, err
	}

	query := d.db.Model(&SessionConnection{}).Where("session_id IN ?", sessionIds)
	return listWithPagination[SessionConnection](query, pag)
}

func (d *DB) GetSessionConnectionById(id string) (*SessionConnection, error) {
	var record SessionConnection
	err := d.db.Model(&SessionConnection{}).Where("id = ?", id).First(&record).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}
	return &record, nil
}
