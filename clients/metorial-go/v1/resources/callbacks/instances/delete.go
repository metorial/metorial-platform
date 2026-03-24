package instances

import (
	"encoding/json"
	"time"
)

// CallbacksInstancesDeleteOutputTriggers represents the callbacks instances delete output triggers type.
type CallbacksInstancesDeleteOutputTriggers struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique receiver trigger identifier
	Id string `json:"id"`
	// Source - How this trigger is invoked by the provider backend
	Source string `json:"source"`
	// PollIntervalSeconds - Polling interval in seconds when the trigger uses polling
	PollIntervalSeconds *float64 `json:"poll_interval_seconds,omitempty"`
	// NextPollAt - Next scheduled poll timestamp for polling triggers
	NextPollAt *time.Time `json:"next_poll_at,omitempty"`
	// LastPolledAt - Last successful poll timestamp for polling triggers
	LastPolledAt *time.Time `json:"last_polled_at,omitempty"`
	// WebhookUrl - Provider webhook URL registered for this trigger when webhook delivery is used
	WebhookUrl *string `json:"webhook_url,omitempty"`
	// IsWebhookRegistered - Whether webhook registration is currently active for this trigger
	IsWebhookRegistered bool `json:"is_webhook_registered"`
	// ProviderTrigger - Provider trigger metadata associated with this callback instance trigger
	ProviderTrigger *any `json:"provider_trigger,omitempty"`
}

// CallbacksInstancesDeleteOutput represents the callbacks instances delete output type.
type CallbacksInstancesDeleteOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique callback instance identifier
	Id string `json:"id"`
	// Status - Whether the callback instance is currently attached to a deployment/config pair
	Status string `json:"status"`
	// RegistrationStatus - Registration state of the underlying trigger receiver
	RegistrationStatus string `json:"registration_status"`
	// Triggers - Resolved trigger registrations for this callback instance
	Triggers []CallbacksInstancesDeleteOutputTriggers `json:"triggers"`
	// CreatedAt - Timestamp when the callback instance was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the callback instance was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCallbacksInstancesDeleteOutputFromJSON deserializes JSON data into a CallbacksInstancesDeleteOutput.
func MapCallbacksInstancesDeleteOutputFromJSON(data []byte) (*CallbacksInstancesDeleteOutput, error) {
	var v CallbacksInstancesDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksInstancesDeleteOutputToJSON serializes a CallbacksInstancesDeleteOutput to JSON.
func MapCallbacksInstancesDeleteOutputToJSON(v *CallbacksInstancesDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
