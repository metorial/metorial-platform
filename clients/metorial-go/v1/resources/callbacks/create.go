package callbacks

import (
	"encoding/json"
	"time"
)

// CallbacksCreateOutputProviderDeployment represents the callbacks create output provider deployment type.
type CallbacksCreateOutputProviderDeployment struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Deployment ID
	Id string `json:"id"`
	// IsDefault - Whether this is the default deployment
	IsDefault bool `json:"is_default"`
	// Name - Deployment name
	Name *string `json:"name,omitempty"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CallbacksCreateOutputProviderTriggers represents the callbacks create output provider triggers type.
type CallbacksCreateOutputProviderTriggers struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique callback trigger association identifier
	Id string `json:"id"`
	// ProviderTriggerId - Provider trigger identifier from the deployment specification
	ProviderTriggerId string `json:"provider_trigger_id"`
	// ProviderTriggerKey - Stable trigger key used by the provider
	ProviderTriggerKey string `json:"provider_trigger_key"`
	// ProviderTriggerName - Human-readable trigger name
	ProviderTriggerName string `json:"provider_trigger_name"`
	// EventTypes - Provider-specific event types enabled for this trigger
	EventTypes []string `json:"event_types"`
	// CreatedAt - Timestamp when this trigger was attached to the callback
	CreatedAt time.Time `json:"created_at"`
}

// CallbacksCreateOutput represents the callbacks create output type.
type CallbacksCreateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique callback identifier
	Id string `json:"id"`
	// Status - Callback lifecycle status
	Status string `json:"status"`
	// Name - Display name for the callback
	Name string `json:"name"`
	// Description - Optional callback description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional callback metadata
	Metadata *map[string]any `json:"metadata,omitempty"`
	// PollIntervalSecondsOverride - Optional polling interval override, in seconds, for polling-capable triggers
	PollIntervalSecondsOverride *float64                                `json:"poll_interval_seconds_override,omitempty"`
	ProviderDeployment          CallbacksCreateOutputProviderDeployment `json:"provider_deployment"`
	// ProviderTriggers - Triggers configured on this callback
	ProviderTriggers []CallbacksCreateOutputProviderTriggers `json:"provider_triggers"`
	// CreatedAt - Timestamp when the callback was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the callback was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCallbacksCreateOutputFromJSON deserializes JSON data into a CallbacksCreateOutput.
func MapCallbacksCreateOutputFromJSON(data []byte) (*CallbacksCreateOutput, error) {
	var v CallbacksCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksCreateOutputToJSON serializes a CallbacksCreateOutput to JSON.
func MapCallbacksCreateOutputToJSON(v *CallbacksCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksCreateBodyTriggers - Trigger definition for this callback
type CallbacksCreateBodyTriggers struct {
	// TriggerId - Provider trigger key or identifier from the deployment specification
	TriggerId string `json:"trigger_id"`
	// EventTypes - Optional provider-specific event type filters for this trigger
	EventTypes *[]string `json:"event_types,omitempty"`
}

// CallbacksCreateBody represents the callbacks create body type.
type CallbacksCreateBody struct {
	// ProviderDeploymentId - Provider deployment that owns the trigger specification for this callback
	ProviderDeploymentId string `json:"provider_deployment_id"`
	// Name - Display name for the callback
	Name string `json:"name"`
	// Description - Optional callback description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional callback metadata
	Metadata *map[string]any `json:"metadata,omitempty"`
	// PollIntervalSecondsOverride - Optional polling interval override, in seconds, for polling triggers
	PollIntervalSecondsOverride *float64 `json:"poll_interval_seconds_override,omitempty"`
	// DestinationIds - Callback destination IDs that should receive deliveries
	DestinationIds []string                      `json:"destination_ids"`
	Triggers       []CallbacksCreateBodyTriggers `json:"triggers"`
}

// MapCallbacksCreateBodyFromJSON deserializes JSON data into a CallbacksCreateBody.
func MapCallbacksCreateBodyFromJSON(data []byte) (*CallbacksCreateBody, error) {
	var v CallbacksCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksCreateBodyToJSON serializes a CallbacksCreateBody to JSON.
func MapCallbacksCreateBodyToJSON(v *CallbacksCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
