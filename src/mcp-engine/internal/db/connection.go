package db

import (
	"database/sql"
	"time"
)

type SessionConnectionType uint8

const (
	SessionConnectionTypeRemote SessionConnectionType = 0
	SessionConnectionTypeRunner SessionConnectionType = 1
)

type SessionConnectionStatus uint8

const (
	SessionConnectionStatusActive  SessionConnectionStatus = 0
	SessionConnectionStatusClosed  SessionConnectionStatus = 1
	SessionConnectionStatusExpired SessionConnectionStatus = 2
	SessionConnectionStatusError   SessionConnectionStatus = 3
)

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
