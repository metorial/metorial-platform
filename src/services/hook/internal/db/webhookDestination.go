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

type EventDestination struct {
	ID         string `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	InstanceID string `gorm:"type:varchar(255);not null;index" json:"instance_id"`

	URL         string      `gorm:"type:text;not null" json:"url"`
	Method      string      `gorm:"type:varchar(10);not null;default:'POST'" json:"method"`
	Events      []string    `gorm:"type:jsonb" json:"events"`
	RetryConfig RetryConfig `gorm:"type:jsonb" json:"retry_config"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func NewEventDestination(instanceID, url, method string, events []string, retryConfig RetryConfig) *EventDestination {
	return &EventDestination{
		ID:          util.Must(uuid.NewV7()).String(),
		InstanceID:  instanceID,
		URL:         url,
		Method:      method,
		Events:      events,
		RetryConfig: retryConfig,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
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
	destination.DeletedAt = gorm.DeletedAt{Time: time.Now(), Valid: true}
	return d.db.Save(destination).Error
}

func (d *DB) ListEventDestinations(instanceID string, pag *hook.ListPagination) ([]EventDestination, error) {
	query := d.db.
		Where("instance_id = ?", instanceID).
		Where("deleted_at IS NULL").
		Order("created_at DESC")

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
