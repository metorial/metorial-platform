package db

import (
	"time"

	"github.com/google/uuid"
	"github.com/metorial/metorial/modules/util"
	"github.com/metorial/metorial/services/hook/gen/hook"
	"gorm.io/gorm"
)

type EventDeliveryAttempt struct {
	ID string `gorm:"type:uuid;primary_key;default:gen_random_uuid()"`

	IntentID string               `gorm:"type:uuid;not null;index"`
	Intent   *EventDeliveryIntent `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	Success       bool  `gorm:"default:false"`
	AttemptNumber uint  `gorm:"not null"`
	DurationMs    int64 `gorm:"default:0"`

	// RequestHeaders map[string]any `gorm:"type:jsonb"`
	ResponseStatus int
	// ResponseBody    string         `gorm:"type:text"`
	// ResponseHeaders map[string]any `gorm:"type:jsonb"`
	// ErrorMessage    string         `gorm:"type:text"`

	CreatedAt time.Time
}

func NewEventDeliveryAttempt(intent *EventDeliveryIntent, attemptNumber uint) *EventDeliveryAttempt {
	return &EventDeliveryAttempt{
		ID:            util.Must(uuid.NewV7()).String(),
		IntentID:      intent.ID,
		Intent:        intent,
		AttemptNumber: attemptNumber,
		CreatedAt:     time.Now(),
	}
}

func (d *DB) CreateEventDeliveryAttempt(attempt *EventDeliveryAttempt) (*EventDeliveryAttempt, error) {
	attempt.CreatedAt = time.Now()

	return attempt, d.db.Create(attempt).Error
}

func (d *DB) GetEventDeliveryAttemptByID(id string) (*EventDeliveryAttempt, error) {
	var attempt EventDeliveryAttempt
	err := d.db.Where("id = ?", id).First(&attempt).Error

	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return &attempt, nil
}

func (d *DB) ListEventDeliveryAttempts(intentID string, pag *hook.ListPagination) ([]EventDeliveryAttempt, error) {
	query := d.db.Where("intent_id = ?", intentID)
	return listWithPagination[EventDeliveryAttempt](query, pag)
}
