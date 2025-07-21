package db

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	gonanoid "github.com/matoous/go-nanoid/v2"
	"github.com/metorial/metorial/modules/util"
	"gorm.io/gorm"
)

type EventDestinationWebhook struct {
	ID string `gorm:"primaryKey;type:uuid;not null"`

	URL    string `gorm:"type:text;not null"`
	Method string `gorm:"type:varchar(10);not null;default:'POST'"`

	SigningSecret string `gorm:"type:text;not null"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func GetWebhookSigningSecret() string {
	return fmt.Sprintf(
		"mt_whsec_%s",
		util.Must(gonanoid.Generate("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 50)),
	)
}

func NewEventDestinationWebhook(url, method string) *EventDestinationWebhook {
	return &EventDestinationWebhook{
		ID:            util.Must(uuid.NewV7()).String(),
		URL:           url,
		Method:        method,
		SigningSecret: GetWebhookSigningSecret(),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
}

func (d *DB) CreateEventDestinationWebhook(webhook *EventDestinationWebhook) (*EventDestinationWebhook, error) {
	webhook.CreatedAt = time.Now()
	webhook.UpdatedAt = webhook.CreatedAt

	return webhook, d.db.Create(webhook).Error
}

func (d *DB) GetEventDestinationWebhookByID(id string) (*EventDestinationWebhook, error) {
	var webhook EventDestinationWebhook
	err := d.db.Where("id = ?", id).First(&webhook).Error

	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	if err != nil {
		return nil, err
	}

	return &webhook, nil
}

func (d *DB) SaveEventDestinationWebhook(webhook *EventDestinationWebhook) error {
	webhook.UpdatedAt = time.Now()
	return d.db.Save(webhook).Error
}

func (d *DB) RollSigningSecret(webhook *EventDestinationWebhook) error {
	webhook.SigningSecret = GetWebhookSigningSecret()
	return d.SaveEventDestinationWebhook(webhook)
}
