package callbacks

import (
	"encoding/json"
	"time"
)

// CallbacksGetOutputProviderDeployment represents the callbacks get output provider deployment type.
type CallbacksGetOutputProviderDeployment struct {
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

// CallbacksGetOutputProviderTriggers represents the callbacks get output provider triggers type.
type CallbacksGetOutputProviderTriggers struct {
	Object              string    `json:"object"`
	Id                  string    `json:"id"`
	ProviderTriggerId   string    `json:"provider_trigger_id"`
	ProviderTriggerKey  string    `json:"provider_trigger_key"`
	ProviderTriggerName string    `json:"provider_trigger_name"`
	EventTypes          []string  `json:"event_types"`
	CreatedAt           time.Time `json:"created_at"`
}

// CallbacksGetOutput represents the callbacks get output type.
type CallbacksGetOutput struct {
	Object                      string                               `json:"object"`
	Id                          string                               `json:"id"`
	Status                      string                               `json:"status"`
	Name                        string                               `json:"name"`
	Description                 *string                              `json:"description,omitempty"`
	Metadata                    *map[string]any                      `json:"metadata,omitempty"`
	PollIntervalSecondsOverride *float64                             `json:"poll_interval_seconds_override,omitempty"`
	ProviderDeployment          CallbacksGetOutputProviderDeployment `json:"provider_deployment"`
	ProviderTriggers            []CallbacksGetOutputProviderTriggers `json:"provider_triggers"`
	CreatedAt                   time.Time                            `json:"created_at"`
	UpdatedAt                   time.Time                            `json:"updated_at"`
}

// MapCallbacksGetOutputFromJSON deserializes JSON data into a CallbacksGetOutput.
func MapCallbacksGetOutputFromJSON(data []byte) (*CallbacksGetOutput, error) {
	var v CallbacksGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksGetOutputToJSON serializes a CallbacksGetOutput to JSON.
func MapCallbacksGetOutputToJSON(v *CallbacksGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
