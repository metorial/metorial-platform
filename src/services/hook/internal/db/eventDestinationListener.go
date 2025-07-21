package db

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	gonanoid "github.com/matoous/go-nanoid/v2"
	"github.com/metorial/metorial/modules/util"
	"gorm.io/gorm"
)

type EventDestinationListener struct {
	ID string `gorm:"primaryKey;type:uuid;not null"`

	DeviceID      string `gorm:"type:varchar(255);not null"`
	DeviceName    string `gorm:"type:varchar(255);not null"`
	DeviceVersion string `gorm:"type:varchar(255);not null"`
	DeviceIp      string `gorm:"type:varchar(255);not null"`

	Token string `gorm:"type:text;not null"`

	CreatedAt    time.Time
	UpdatedAt    time.Time
	LastActiveAt *time.Time `json:"last_active_at,omitempty"`
}

func GetListenerToken() string {
	return fmt.Sprintf(
		"mt_evtlstk_%s",
		util.Must(gonanoid.Generate("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 50)),
	)
}

func NewEventDestinationListener(deviceId, deviceName, deviceVersion, deviceIp string) *EventDestinationListener {
	return &EventDestinationListener{
		ID:            util.Must(uuid.NewV7()).String(),
		DeviceID:      deviceId,
		DeviceName:    deviceName,
		DeviceVersion: deviceVersion,
		DeviceIp:      deviceIp,
		Token:         GetListenerToken(),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
}

func (d *DB) CreateEventDestinationListener(webhook *EventDestinationListener) (*EventDestinationListener, error) {
	webhook.CreatedAt = time.Now()
	webhook.UpdatedAt = webhook.CreatedAt

	return webhook, d.db.Create(webhook).Error
}

func (d *DB) GetEventDestinationListenerByID(id string) (*EventDestinationListener, error) {
	var webhook EventDestinationListener
	err := d.db.Where("id = ?", id).First(&webhook).Error

	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return &webhook, nil
}

func (d *DB) SaveEventDestinationListener(webhook *EventDestinationListener) error {
	webhook.UpdatedAt = time.Now()
	return d.db.Save(webhook).Error
}
