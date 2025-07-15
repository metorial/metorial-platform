package db

import (
	"database/sql"
	"time"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	"gorm.io/gorm"
)

type SessionRunType uint8

const (
	SessionRunTypeRemote    SessionRunType = 0
	SessionRunTypeContainer SessionRunType = 1
)

func (s SessionRunType) ToPb() managerPb.EngineRunType {
	switch s {
	case SessionRunTypeRemote:
		return managerPb.EngineRunType_run_type_remote
	case SessionRunTypeContainer:
		return managerPb.EngineRunType_run_type_container
	default:
		return managerPb.EngineRunType_run_type_unknown
	}
}

type SessionRunStatus uint8

const (
	SessionRunStatusActive  SessionRunStatus = 0
	SessionRunStatusClosed  SessionRunStatus = 1
	SessionRunStatusExpired SessionRunStatus = 2
	SessionRunStatusError   SessionRunStatus = 3
)

func (s SessionRunStatus) ToPb() managerPb.EngineRunStatus {
	switch s {
	case SessionRunStatusActive:
		return managerPb.EngineRunStatus_run_status_active
	case SessionRunStatusClosed:
		return managerPb.EngineRunStatus_run_status_closed
	case SessionRunStatusExpired:
		return managerPb.EngineRunStatus_run_status_expired
	case SessionRunStatusError:
		return managerPb.EngineRunStatus_run_status_error
	default:
		return managerPb.EngineRunStatus_run_status_unknown
	}
}

type SessionRun struct {
	ID string `gorm:"primaryKey;type:uuid;not null"`

	SessionID string   `gorm:"type:uuid;not null"`
	Session   *Session `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	Type   SessionRunType   `gorm:"type:smallint;not null"`
	Status SessionRunStatus `gorm:"type:smallint;not null;index"`

	HasError bool `gorm:"default:false;not null"`

	WorkerID string `gorm:"type:uuid;not null"`

	CreatedAt  time.Time `gorm:"not null"`
	UpdatedAt  time.Time `gorm:"not null"`
	StartedAt  time.Time `gorm:"not null"`
	LastPingAt time.Time `gorm:"not null"`
	EndedAt    sql.NullTime
}

func NewRun(id string, workerId string, session *Session, type_ SessionRunType, status SessionRunStatus) *SessionRun {
	return &SessionRun{
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

func (d *DB) CreateRun(conn *SessionRun) (*SessionRun, error) {
	conn.CreatedAt = time.Now()

	return conn, d.db.Create(conn).Error
}

func (d *DB) SaveRun(conn *SessionRun) error {
	conn.UpdatedAt = time.Now()
	return d.db.Save(conn).Error
}

func NullTimeNow() sql.NullTime {
	return sql.NullTime{
		Time:  time.Now(),
		Valid: true,
	}
}

func (d *DB) expireActiveSessionRunsRoutine() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		d.db.Model(&SessionRun{}).
			Where("status = ? AND last_ping_at < ?", SessionRunStatusActive, now.Add(-5*time.Minute)).
			Update("status", SessionRunStatusExpired)
	}
}

func (c *SessionRun) ToPb() (*managerPb.EngineSessionRun, error) {
	var ses *managerPb.EngineSession

	if c.Session != nil {
		var err error
		ses, err = c.Session.ToPb()
		if err != nil {
			return nil, err
		}
	}

	return &managerPb.EngineSessionRun{
		Id:         c.ID,
		SessionId:  c.SessionID,
		Type:       c.Type.ToPb(),
		Status:     c.Status.ToPb(),
		HasError:   c.HasError,
		WorkerId:   c.WorkerID,
		CreatedAt:  c.CreatedAt.UnixMilli(),
		UpdatedAt:  c.UpdatedAt.UnixMilli(),
		StartedAt:  c.StartedAt.UnixMilli(),
		LastPingAt: c.LastPingAt.UnixMilli(),
		EndedAt: func() int64 {
			if c.EndedAt.Valid {
				return c.EndedAt.Time.UnixMilli()
			}
			return 0
		}(),
		Session: ses,
	}, nil
}

func (d *DB) ListSessionRunsBySession(sessionId string, pag *managerPb.ListPagination, after *int64) ([]SessionRun, error) {
	query := d.db.Model(&SessionRun{}).Preload("Session").Where("session_id = ?", sessionId)
	if after != nil {
		query = query.Where("created_at > ?", time.UnixMilli(*after))
	}
	return listWithPagination[SessionRun](query, pag)
}

func (d *DB) ListSessionRunsBySessionExternalId(externalId string, pag *managerPb.ListPagination) ([]SessionRun, error) {
	sessionIds, err := d.getSessionIdsByExternalId(externalId)
	if err != nil {
		return nil, err
	}

	query := d.db.Model(&SessionRun{}).Preload("Session").Where("session_id IN ?", sessionIds)
	return listWithPagination[SessionRun](query, pag)
}

func (d *DB) GetSessionRunById(id string) (*SessionRun, error) {
	var record SessionRun
	err := d.db.Model(&SessionRun{}).Preload("Session").Where("id = ?", id).First(&record).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (d *DB) ListRecentlyActiveSessionRuns(since time.Time) ([]string, error) {
	var sessions []SessionRun
	err := d.db.Model(&SessionRun{}).
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
