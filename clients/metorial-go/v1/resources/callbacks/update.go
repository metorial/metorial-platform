package callbacks

import (
	"encoding/json"
	"time"
)

// CallbacksUpdateOutputProviderDeployment represents the callbacks update output provider deployment type.
type CallbacksUpdateOutputProviderDeployment struct {
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

// CallbacksUpdateOutputProviderTriggers represents the callbacks update output provider triggers type.
type CallbacksUpdateOutputProviderTriggers struct {
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

// CallbacksUpdateOutput represents the callbacks update output type.
type CallbacksUpdateOutput struct {
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
	ProviderDeployment          CallbacksUpdateOutputProviderDeployment `json:"provider_deployment"`
	// ProviderTriggers - Triggers configured on this callback
	ProviderTriggers []CallbacksUpdateOutputProviderTriggers `json:"provider_triggers"`
	// CreatedAt - Timestamp when the callback was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the callback was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCallbacksUpdateOutputFromJSON deserializes JSON data into a CallbacksUpdateOutput.
func MapCallbacksUpdateOutputFromJSON(data []byte) (*CallbacksUpdateOutput, error) {
	var v CallbacksUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksUpdateOutputToJSON serializes a CallbacksUpdateOutput to JSON.
func MapCallbacksUpdateOutputToJSON(v *CallbacksUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksUpdateBodyTriggers - Updated trigger definition for this callback
type CallbacksUpdateBodyTriggers struct {
	// TriggerId - Provider trigger key or identifier
	TriggerId string `json:"trigger_id"`
	// EventTypes - Updated provider-specific event type filters for this trigger
	EventTypes *[]string `json:"event_types,omitempty"`
}

// CallbacksUpdateBody represents the callbacks update body type.
type CallbacksUpdateBody struct {
	// Name - Updated callback display name
	Name *string `json:"name,omitempty"`
	// Description - Updated callback description
	Description *string `json:"description,omitempty"`
	// Metadata - Updated custom metadata for the callback
	Metadata *map[string]any `json:"metadata,omitempty"`
	// PollIntervalSecondsOverride - Updated polling interval override, in seconds
	PollIntervalSecondsOverride *float64 `json:"poll_interval_seconds_override,omitempty"`
	// DestinationIds - Replacement list of callback destination IDs
	DestinationIds *[]string                      `json:"destination_ids,omitempty"`
	Triggers       *[]CallbacksUpdateBodyTriggers `json:"triggers,omitempty"`
}

// MapCallbacksUpdateBodyFromJSON deserializes JSON data into a CallbacksUpdateBody.
func MapCallbacksUpdateBodyFromJSON(data []byte) (*CallbacksUpdateBody, error) {
	var v CallbacksUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksUpdateBodyToJSON serializes a CallbacksUpdateBody to JSON.
func MapCallbacksUpdateBodyToJSON(v *CallbacksUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
