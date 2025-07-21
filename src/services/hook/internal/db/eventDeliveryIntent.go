package db

import (
	"time"

	"github.com/google/uuid"
	"github.com/metorial/metorial/modules/util"
	"github.com/metorial/metorial/services/hook/gen/hook"
	"gorm.io/gorm"
)

type IntentStatus string

const (
	IntentStatusPending     IntentStatus = "pending"
	IntentStatusSuccess     IntentStatus = "success"
	IntentStatusErrorRetry  IntentStatus = "error_retry"
	IntentStatusErrorFailed IntentStatus = "error_failed"
)

type EventDeliveryIntent struct {
	ID string `gorm:"primaryKey;type:uuid;not null"`

	Status       IntentStatus `gorm:"type:varchar(50);not null;default:'pending';index"`
	AttemptCount uint         `gorm:"default:0"`

	EventID string `gorm:"type:uuid;not null;index"`
	Event   *Event `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	DestinationID string            `gorm:"type:uuid;not null;index"`
	Destination   *EventDestination `gorm:"constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`

	Attempts []*EventDeliveryAttempt

	NextAttemptAt *time.Time `gorm:"index"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func NewEventDeliveryIntent(event *Event, destination *EventDestination) *EventDeliveryIntent {
	return &EventDeliveryIntent{
		ID:            util.Must(uuid.NewV7()).String(),
		Status:        IntentStatusPending,
		EventID:       event.ID,
		Event:         event,
		DestinationID: destination.ID,
		Destination:   destination,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
}

func NewEventDeliveryIntentLight(eventID, destinationID string) *EventDeliveryIntent {
	return &EventDeliveryIntent{
		ID:            util.Must(uuid.NewV7()).String(),
		Status:        IntentStatusPending,
		DestinationID: destinationID,
		EventID:       eventID,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
}

func (d *DB) CreateEventDeliveryIntent(intent *EventDeliveryIntent) (*EventDeliveryIntent, error) {
	intent.CreatedAt = time.Now()
	intent.UpdatedAt = intent.CreatedAt

	return intent, d.db.Create(intent).Error
}

func (d *DB) SaveEventDeliveryIntent(intent *EventDeliveryIntent) error {
	intent.UpdatedAt = time.Now()

	return d.db.Save(intent).Error
}

func (d *DB) GetEventDeliveryIntentByID(id string) (*EventDeliveryIntent, error) {
	var intent EventDeliveryIntent
	err := d.db.Where("id = ?", id).
		Preload("Event").
		Preload("Destination").
		Preload("Destination.Webhook").
		Preload("Destination.Listener").
		First(&intent).Error

	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return &intent, nil
}

func (d *DB) ListEventDeliveryIntents(
	instanceID string,
	destinationId *string,
	eventId *string,
	pag *hook.ListPagination,
) ([]EventDeliveryIntent, error) {
	query := d.db.Where("instance_id = ?", instanceID)
	return listWithPagination[EventDeliveryIntent](query, pag)
}
