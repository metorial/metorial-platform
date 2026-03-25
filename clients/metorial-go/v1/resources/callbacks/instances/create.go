package instances

import (
	"encoding/json"
	"time"
)

// CallbacksInstancesCreateOutputTriggersProviderTriggerInputSchema represents the callbacks instances create output triggers provider trigger input schema type.
type CallbacksInstancesCreateOutputTriggersProviderTriggerInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the trigger payload input shape
	Schema map[string]any `json:"schema"`
}

// CallbacksInstancesCreateOutputTriggersProviderTriggerOutputSchema represents the callbacks instances create output triggers provider trigger output schema type.
type CallbacksInstancesCreateOutputTriggersProviderTriggerOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the trigger delivery output shape
	Schema map[string]any `json:"schema"`
}

// CallbacksInstancesCreateOutputTriggersProviderTriggerInvocationAutoRegistration represents the callbacks instances create output triggers provider trigger invocation auto registration type.
type CallbacksInstancesCreateOutputTriggersProviderTriggerInvocationAutoRegistration struct {
	// Status - Whether automatic webhook registration is supported
	Status string `json:"status"`
}

// CallbacksInstancesCreateOutputTriggersProviderTriggerInvocationAutoUnregistration represents the callbacks instances create output triggers provider trigger invocation auto unregistration type.
type CallbacksInstancesCreateOutputTriggersProviderTriggerInvocationAutoUnregistration struct {
	// Status - Whether automatic webhook removal is supported
	Status string `json:"status"`
}

// CallbacksInstancesCreateOutputTriggersProviderTriggerInvocation represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type CallbacksInstancesCreateOutputTriggersProviderTriggerInvocation struct {
	Type *string `json:"type,omitempty"`
	// IntervalSeconds - Polling interval in seconds for polling-based triggers
	IntervalSeconds    *float64                                                                           `json:"interval_seconds,omitempty"`
	AutoRegistration   *CallbacksInstancesCreateOutputTriggersProviderTriggerInvocationAutoRegistration   `json:"auto_registration,omitempty"`
	AutoUnregistration *CallbacksInstancesCreateOutputTriggersProviderTriggerInvocationAutoUnregistration `json:"auto_unregistration,omitempty"`
}

// CallbacksInstancesCreateOutputTriggersProviderTrigger represents the callbacks instances create output triggers provider trigger type.
type CallbacksInstancesCreateOutputTriggersProviderTrigger struct {
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
	InputSchema  *CallbacksInstancesCreateOutputTriggersProviderTriggerInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *CallbacksInstancesCreateOutputTriggersProviderTriggerOutputSchema `json:"output_schema,omitempty"`
	Invocation   CallbacksInstancesCreateOutputTriggersProviderTriggerInvocation    `json:"invocation"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Provider specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

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
	IsWebhookRegistered *bool                                                  `json:"is_webhook_registered,omitempty"`
	ProviderTrigger     *CallbacksInstancesCreateOutputTriggersProviderTrigger `json:"provider_trigger,omitempty"`
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
