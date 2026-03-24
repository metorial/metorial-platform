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
	Object              string    `json:"object"`
	Id                  string    `json:"id"`
	ProviderTriggerId   string    `json:"provider_trigger_id"`
	ProviderTriggerKey  string    `json:"provider_trigger_key"`
	ProviderTriggerName string    `json:"provider_trigger_name"`
	EventTypes          []string  `json:"event_types"`
	CreatedAt           time.Time `json:"created_at"`
}

// CallbacksCreateOutput represents the callbacks create output type.
type CallbacksCreateOutput struct {
	Object                      string                                  `json:"object"`
	Id                          string                                  `json:"id"`
	Status                      string                                  `json:"status"`
	Name                        string                                  `json:"name"`
	Description                 *string                                 `json:"description,omitempty"`
	Metadata                    *map[string]any                         `json:"metadata,omitempty"`
	PollIntervalSecondsOverride *float64                                `json:"poll_interval_seconds_override,omitempty"`
	ProviderDeployment          CallbacksCreateOutputProviderDeployment `json:"provider_deployment"`
	ProviderTriggers            []CallbacksCreateOutputProviderTriggers `json:"provider_triggers"`
	CreatedAt                   time.Time                               `json:"created_at"`
	UpdatedAt                   time.Time                               `json:"updated_at"`
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

// CallbacksCreateBodyTriggers represents the callbacks create body triggers type.
type CallbacksCreateBodyTriggers struct {
	TriggerId  string    `json:"trigger_id"`
	EventTypes *[]string `json:"event_types,omitempty"`
}

// CallbacksCreateBody represents the callbacks create body type.
type CallbacksCreateBody struct {
	ProviderDeploymentId        string                        `json:"provider_deployment_id"`
	Name                        string                        `json:"name"`
	Description                 *string                       `json:"description,omitempty"`
	Metadata                    *map[string]any               `json:"metadata,omitempty"`
	PollIntervalSecondsOverride *float64                      `json:"poll_interval_seconds_override,omitempty"`
	DestinationIds              []string                      `json:"destination_ids"`
	Triggers                    []CallbacksCreateBodyTriggers `json:"triggers"`
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
