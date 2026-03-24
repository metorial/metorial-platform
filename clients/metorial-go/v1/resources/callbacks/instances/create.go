package instances

import (
	"encoding/json"
	"time"
)

// CallbacksInstancesCreateOutputTriggers represents the callbacks instances create output triggers type.
type CallbacksInstancesCreateOutputTriggers struct {
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

// CallbacksInstancesCreateOutput represents the callbacks instances create output type.
type CallbacksInstancesCreateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique callback instance identifier
	Id string `json:"id"`
	// Status - Whether the callback instance is currently attached to a deployment/config pair
	Status string `json:"status"`
	// RegistrationStatus - Registration state of the underlying trigger receiver
	RegistrationStatus string `json:"registration_status"`
	// Triggers - Resolved trigger registrations for this callback instance
	Triggers []CallbacksInstancesCreateOutputTriggers `json:"triggers"`
	// CreatedAt - Timestamp when the callback instance was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the callback instance was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCallbacksInstancesCreateOutputFromJSON deserializes JSON data into a CallbacksInstancesCreateOutput.
func MapCallbacksInstancesCreateOutputFromJSON(data []byte) (*CallbacksInstancesCreateOutput, error) {
	var v CallbacksInstancesCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksInstancesCreateOutputToJSON serializes a CallbacksInstancesCreateOutput to JSON.
func MapCallbacksInstancesCreateOutputToJSON(v *CallbacksInstancesCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksInstancesCreateBody represents the callbacks instances create body type.
type CallbacksInstancesCreateBody struct {
	// ProviderConfigId - Provider config to attach to the callback instance
	ProviderConfigId string `json:"provider_config_id"`
	// ProviderAuthConfigId - Optional provider auth config to attach to the callback instance
	ProviderAuthConfigId *string `json:"provider_auth_config_id,omitempty"`
}

// MapCallbacksInstancesCreateBodyFromJSON deserializes JSON data into a CallbacksInstancesCreateBody.
func MapCallbacksInstancesCreateBodyFromJSON(data []byte) (*CallbacksInstancesCreateBody, error) {
	var v CallbacksInstancesCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksInstancesCreateBodyToJSON serializes a CallbacksInstancesCreateBody to JSON.
func MapCallbacksInstancesCreateBodyToJSON(v *CallbacksInstancesCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
