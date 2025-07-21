package db

import (
	"time"

	"github.com/google/uuid"
	"github.com/metorial/metorial/modules/util"
	"github.com/metorial/metorial/services/hook/gen/hook"
	"gorm.io/gorm"
)

type RetryType string

const (
	RetryTypeLinear      RetryType = "linear"
	RetryTypeExponential RetryType = "exponential"
)

type RetryConfig struct {
	Type        RetryType `json:"type"`
	Delay       uint      `json:"delay"`
	MaxAttempts uint      `json:"max_attempts"`
}

type EventDestinationType string

const (
	EventDestinationTypeWebhook  EventDestinationType = "webhook"
	EventDestinationTypeListener EventDestinationType = "listener"
)

type EventDestination struct {
	ID         string `gorm:"primaryKey;type:uuid;not null"`
	InstanceID string `gorm:"type:varchar(255);not null;index"`

	Type EventDestinationType `gorm:"type:varchar(50);not null;index"`

	WebhookID string `gorm:"type:uuid;not null"`
	Webhook   *EventDestinationWebhook

	ListenerID string `gorm:"type:uuid;not null"`
	Listener   *EventDestinationListener

	Events      []string    `gorm:"type:jsonb"`
	RetryConfig RetryConfig `gorm:"type:jsonb"`

	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    *time.Time `gorm:"index" json:"deleted_at,omitempty"`
	LastActiveAt *time.Time `gorm:"index" json:"last_active_at,omitempty"`
	ExpiresAt    *time.Time `gorm:"index" json:"expires_at,omitempty"`
}

func NewEventDestination(
	instanceID string,
	webhook *EventDestinationWebhook,
	listener *EventDestinationListener,
	events []string,
	retryConfig RetryConfig,
	expiresAt *time.Time,
) *EventDestination {
	var destinationType EventDestinationType
	if webhook != nil {
		destinationType = EventDestinationTypeWebhook
	} else if listener != nil {
		destinationType = EventDestinationTypeListener
	} else {
		panic("EventDestination must have either a webhook or listener")
	}

	return &EventDestination{
		ID:          util.Must(uuid.NewV7()).String(),
		InstanceID:  instanceID,
		Type:        destinationType,
		WebhookID:   webhook.ID,
		Webhook:     webhook,
		ListenerID:  listener.ID,
		Listener:    listener,
		Events:      events,
		RetryConfig: retryConfig,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		ExpiresAt:   expiresAt,
	}
}

func (d *DB) CreateEventDestination(destination *EventDestination) (*EventDestination, error) {
	destination.CreatedAt = time.Now()
	destination.UpdatedAt = destination.CreatedAt

	if destination.Events == nil {
		destination.Events = []string{}
	}

	return destination, d.db.Create(destination).Error
}

func (d *DB) SaveEventDestination(destination *EventDestination) error {
	destination.UpdatedAt = time.Now()

	if destination.Events == nil {
		destination.Events = []string{}
	}

	return d.db.Save(destination).Error
}

func (d *DB) DeleteEventDestination(destination *EventDestination) error {
	destination.DeletedAt = util.Ptr(time.Now())
	return d.db.Save(destination).Error
}

func (d *DB) ListEventDestinations(instanceID string, pag *hook.ListPagination) ([]EventDestination, error) {
	query := d.db.Where("instance_id = ?", instanceID).Where("deleted_at IS NULL")
	return listWithPagination[EventDestination](query, pag)
}

func (d *DB) GetEventDestinationByID(id string) (*EventDestination, error) {
	var destination EventDestination
	err := d.db.Where("id = ?", id).First(&destination).Error

	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return &destination, nil
}

func (d *DB) GetAllEventDestinationsByInstanceIdAndEventType(
	instanceID string,
	eventType string,
) ([]EventDestination, error) {
	query := d.db.Where("instance_id = ?", instanceID).
		Where("deleted_at IS NULL").
		Where("events @> ?", []string{eventType})

	var destinations []EventDestination
	err := query.Find(&destinations).Error
	if err != nil {
		return nil, err
	}

	return destinations, nil
}
