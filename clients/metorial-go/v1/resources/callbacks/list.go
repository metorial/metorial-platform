package callbacks

import (
	"encoding/json"
	"time"
)

// CallbacksListOutputItemsProviderDeployment represents the callbacks list output items provider deployment type.
type CallbacksListOutputItemsProviderDeployment struct {
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

// CallbacksListOutputItemsProviderTriggers represents the callbacks list output items provider triggers type.
type CallbacksListOutputItemsProviderTriggers struct {
	Object              string    `json:"object"`
	Id                  string    `json:"id"`
	ProviderTriggerId   string    `json:"provider_trigger_id"`
	ProviderTriggerKey  string    `json:"provider_trigger_key"`
	ProviderTriggerName string    `json:"provider_trigger_name"`
	EventTypes          []string  `json:"event_types"`
	CreatedAt           time.Time `json:"created_at"`
}

// CallbacksListOutputItems represents the callbacks list output items type.
type CallbacksListOutputItems struct {
	Object                      string                                     `json:"object"`
	Id                          string                                     `json:"id"`
	Status                      string                                     `json:"status"`
	Name                        string                                     `json:"name"`
	Description                 *string                                    `json:"description,omitempty"`
	Metadata                    *map[string]any                            `json:"metadata,omitempty"`
	PollIntervalSecondsOverride *float64                                   `json:"poll_interval_seconds_override,omitempty"`
	ProviderDeployment          CallbacksListOutputItemsProviderDeployment `json:"provider_deployment"`
	ProviderTriggers            []CallbacksListOutputItemsProviderTriggers `json:"provider_triggers"`
	CreatedAt                   time.Time                                  `json:"created_at"`
	UpdatedAt                   time.Time                                  `json:"updated_at"`
}

// CallbacksListOutputPagination represents the callbacks list output pagination type.
type CallbacksListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// CallbacksListOutput represents the callbacks list output type.
type CallbacksListOutput struct {
	Items      []CallbacksListOutputItems    `json:"items"`
	Pagination CallbacksListOutputPagination `json:"pagination"`
}

// MapCallbacksListOutputFromJSON deserializes JSON data into a CallbacksListOutput.
func MapCallbacksListOutputFromJSON(data []byte) (*CallbacksListOutput, error) {
	var v CallbacksListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksListOutputToJSON serializes a CallbacksListOutput to JSON.
func MapCallbacksListOutputToJSON(v *CallbacksListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CallbacksListQuery represents the callbacks list query type.
type CallbacksListQuery struct {
	Limit                *float64 `json:"limit,omitempty"`
	After                *string  `json:"after,omitempty"`
	Before               *string  `json:"before,omitempty"`
	Cursor               *string  `json:"cursor,omitempty"`
	Order                *string  `json:"order,omitempty"`
	Id                   *any     `json:"id,omitempty"`
	ProviderDeploymentId *any     `json:"provider_deployment_id,omitempty"`
	Status               *any     `json:"status,omitempty"`
}

// MapCallbacksListQueryFromJSON deserializes JSON data into a CallbacksListQuery.
func MapCallbacksListQueryFromJSON(data []byte) (*CallbacksListQuery, error) {
	var v CallbacksListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCallbacksListQueryToJSON serializes a CallbacksListQuery to JSON.
func MapCallbacksListQueryToJSON(v *CallbacksListQuery) ([]byte, error) {
	return json.Marshal(v)
}
