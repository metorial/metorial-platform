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

// CallbacksDeleteOutputProviderTriggers represents the callbacks delete output provider triggers type.
type CallbacksDeleteOutputProviderTriggers struct {
	Object              string    `json:"object"`
	Id                  string    `json:"id"`
	ProviderTriggerId   string    `json:"provider_trigger_id"`
	ProviderTriggerKey  string    `json:"provider_trigger_key"`
	ProviderTriggerName string    `json:"provider_trigger_name"`
	EventTypes          []string  `json:"event_types"`
	CreatedAt           time.Time `json:"created_at"`
}

// CallbacksDeleteOutput represents the callbacks delete output type.
type CallbacksDeleteOutput struct {
	Object                      string                                  `json:"object"`
	Id                          string                                  `json:"id"`
	Status                      string                                  `json:"status"`
	Name                        string                                  `json:"name"`
	Description                 *string                                 `json:"description,omitempty"`
	Metadata                    *map[string]any                         `json:"metadata,omitempty"`
	PollIntervalSecondsOverride *float64                                `json:"poll_interval_seconds_override,omitempty"`
	ProviderDeployment          CallbacksDeleteOutputProviderDeployment `json:"provider_deployment"`
	ProviderTriggers            []CallbacksDeleteOutputProviderTriggers `json:"provider_triggers"`
	CreatedAt                   time.Time                               `json:"created_at"`
	UpdatedAt                   time.Time                               `json:"updated_at"`
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
