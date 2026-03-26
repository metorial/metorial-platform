package callbacks

import (
	"encoding/json"
	"time"
)

// CallbacksDeleteOutputProviderDeployment represents the callbacks delete output provider deployment type.
type CallbacksDeleteOutputProviderDeployment struct {
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

// CallbacksDeleteOutputDestinations represents the callbacks delete output destinations type.
type CallbacksDeleteOutputDestinations struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique callback destination identifier
	Id string `json:"id"`
	// Status - Callback destination lifecycle status
	Status string `json:"status"`
	// Name - Display name for the callback destination
	Name string `json:"name"`
	// Description - Optional destination description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional destination metadata
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Url - Webhook URL that receives callback deliveries
	Url string `json:"url"`
	// Method - HTTP method used for webhook delivery
	Method string `json:"method"`
	// CreatedAt - Timestamp when the callback destination was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the callback destination was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CallbacksDeleteOutputProviderTriggers represents the callbacks delete output provider triggers type.
type CallbacksDeleteOutputProviderTriggers struct {
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

// CallbacksDeleteOutput represents the callbacks delete output type.
type CallbacksDeleteOutput struct {
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
	ProviderDeployment          CallbacksDeleteOutputProviderDeployment `json:"provider_deployment"`
	// Destinations - Destinations currently attached to this callback
	Destinations []CallbacksDeleteOutputDestinations `json:"destinations"`
	// ProviderTriggers - Triggers configured on this callback
	ProviderTriggers []CallbacksDeleteOutputProviderTriggers `json:"provider_triggers"`
	// CreatedAt - Timestamp when the callback was created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the callback was last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCallbacksDeleteOutputFromJSON deserializes JSON data into a CallbacksDeleteOutput.
func MapCallbacksDeleteOutputFromJSON(data []byte) (*CallbacksDeleteOutput, error) {
	var v CallbacksDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksDeleteOutputToJSON serializes a CallbacksDeleteOutput to JSON.
func MapCallbacksDeleteOutputToJSON(v *CallbacksDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
