package instances

import (
	"encoding/json"
	"time"
)

// CallbacksInstancesDeleteOutputTriggersProviderTriggerInputSchema represents the callbacks instances delete output triggers provider trigger input schema type.
type CallbacksInstancesDeleteOutputTriggersProviderTriggerInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the trigger payload input shape
	Schema map[string]any `json:"schema"`
}

// CallbacksInstancesDeleteOutputTriggersProviderTriggerOutputSchema represents the callbacks instances delete output triggers provider trigger output schema type.
type CallbacksInstancesDeleteOutputTriggersProviderTriggerOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the trigger delivery output shape
	Schema map[string]any `json:"schema"`
}

// CallbacksInstancesDeleteOutputTriggersProviderTriggerInvocationAutoRegistration represents the callbacks instances delete output triggers provider trigger invocation auto registration type.
type CallbacksInstancesDeleteOutputTriggersProviderTriggerInvocationAutoRegistration struct {
	// Status - Whether automatic webhook registration is supported
	Status string `json:"status"`
}

// CallbacksInstancesDeleteOutputTriggersProviderTriggerInvocationAutoUnregistration represents the callbacks instances delete output triggers provider trigger invocation auto unregistration type.
type CallbacksInstancesDeleteOutputTriggersProviderTriggerInvocationAutoUnregistration struct {
	// Status - Whether automatic webhook removal is supported
	Status string `json:"status"`
}

// CallbacksInstancesDeleteOutputTriggersProviderTriggerInvocation represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type CallbacksInstancesDeleteOutputTriggersProviderTriggerInvocation struct {
	Type *string `json:"type,omitempty"`
	// IntervalSeconds - Polling interval in seconds for polling-based triggers
	IntervalSeconds    *float64                                                                           `json:"interval_seconds,omitempty"`
	AutoRegistration   *CallbacksInstancesDeleteOutputTriggersProviderTriggerInvocationAutoRegistration   `json:"auto_registration,omitempty"`
	AutoUnregistration *CallbacksInstancesDeleteOutputTriggersProviderTriggerInvocationAutoUnregistration `json:"auto_unregistration,omitempty"`
}

// CallbacksInstancesDeleteOutputTriggersProviderTrigger represents the callbacks instances delete output triggers provider trigger type.
type CallbacksInstancesDeleteOutputTriggersProviderTrigger struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider trigger identifier
	Id string `json:"id"`
	// Key - Trigger key used when subscribing callbacks
	Key string `json:"key"`
	// Name - Display name of the trigger
	Name string `json:"name"`
	// Description - Trigger description
	Description  *string                                                            `json:"description,omitempty"`
	InputSchema  *CallbacksInstancesDeleteOutputTriggersProviderTriggerInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *CallbacksInstancesDeleteOutputTriggersProviderTriggerOutputSchema `json:"output_schema,omitempty"`
	Invocation   CallbacksInstancesDeleteOutputTriggersProviderTriggerInvocation    `json:"invocation"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Provider specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

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
	IsWebhookRegistered *bool                                                  `json:"is_webhook_registered,omitempty"`
	ProviderTrigger     *CallbacksInstancesDeleteOutputTriggersProviderTrigger `json:"provider_trigger,omitempty"`
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
