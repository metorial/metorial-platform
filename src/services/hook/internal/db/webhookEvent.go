package db

import (
	"time"

	"github.com/google/uuid"
	"github.com/metorial/metorial/modules/util"
	"github.com/metorial/metorial/services/hook/gen/hook"
	"gorm.io/gorm"
)

type Event struct {
	ID         string `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	InstanceID string `gorm:"type:varchar(255);not null;index" json:"instance_id"`

	EventType string `gorm:"type:varchar(255);not null;index" json:"event_type"`
	Payload   string `gorm:"type:text" json:"payload"`

	OnlyForDestinations []string `gorm:"type:jsonb" json:"only_for_destinations,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}

func NewEvent(instanceID, eventType, payload string) *Event {
	return &Event{
		ID:         util.Must(uuid.NewV7()).String(),
		InstanceID: instanceID,
		EventType:  eventType,
		Payload:    payload,
		CreatedAt:  time.Now(),
	}
}

func (d *DB) CreateEvent(event *Event) (*Event, error) {
	event.CreatedAt = time.Now()

	return event, d.db.Create(event).Error
}

func (d *DB) GetEventByID(id string) (*Event, error) {
	var event Event
	err := d.db.Where("id = ?", id).First(&event).Error

	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return &event, nil
}

func (d *DB) ListEvents(instanceID string, pag *hook.ListPagination) ([]Event, error) {
	query := d.db.Where("instance_id = ?", instanceID)
	return listWithPagination[Event](query, pag)
}
