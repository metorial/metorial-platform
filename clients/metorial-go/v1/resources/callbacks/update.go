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
	Object              string    `json:"object"`
	Id                  string    `json:"id"`
	ProviderTriggerId   string    `json:"provider_trigger_id"`
	ProviderTriggerKey  string    `json:"provider_trigger_key"`
	ProviderTriggerName string    `json:"provider_trigger_name"`
	EventTypes          []string  `json:"event_types"`
	CreatedAt           time.Time `json:"created_at"`
}

// CallbacksUpdateOutput represents the callbacks update output type.
type CallbacksUpdateOutput struct {
	Object                      string                                  `json:"object"`
	Id                          string                                  `json:"id"`
	Status                      string                                  `json:"status"`
	Name                        string                                  `json:"name"`
	Description                 *string                                 `json:"description,omitempty"`
	Metadata                    *map[string]any                         `json:"metadata,omitempty"`
	PollIntervalSecondsOverride *float64                                `json:"poll_interval_seconds_override,omitempty"`
	ProviderDeployment          CallbacksUpdateOutputProviderDeployment `json:"provider_deployment"`
	ProviderTriggers            []CallbacksUpdateOutputProviderTriggers `json:"provider_triggers"`
	CreatedAt                   time.Time                               `json:"created_at"`
	UpdatedAt                   time.Time                               `json:"updated_at"`
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

// CallbacksUpdateBodyTriggers represents the callbacks update body triggers type.
type CallbacksUpdateBodyTriggers struct {
	TriggerId  string    `json:"trigger_id"`
	EventTypes *[]string `json:"event_types,omitempty"`
}

// CallbacksUpdateBody represents the callbacks update body type.
type CallbacksUpdateBody struct {
	Name                        *string                        `json:"name,omitempty"`
	Description                 *string                        `json:"description,omitempty"`
	Metadata                    *map[string]any                `json:"metadata,omitempty"`
	PollIntervalSecondsOverride *float64                       `json:"poll_interval_seconds_override,omitempty"`
	DestinationIds              *[]string                      `json:"destination_ids,omitempty"`
	Triggers                    *[]CallbacksUpdateBodyTriggers `json:"triggers,omitempty"`
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
