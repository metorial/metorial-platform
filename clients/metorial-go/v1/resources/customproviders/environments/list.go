package environments

import (
	"encoding/json"
	"time"
)

// CustomProvidersEnvironmentsListOutputItems represents the custom providers environments list output items type.
type CustomProvidersEnvironmentsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider environment identifier
	Id string `json:"id"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId *string `json:"provider_id,omitempty"`
	// CurrentProviderVersionId - ID of the current provider version in this environment
	CurrentProviderVersionId *string `json:"current_provider_version_id,omitempty"`
	// InstanceId - ID of the instance this environment is associated with
	InstanceId string `json:"instance_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersEnvironmentsListOutputPagination represents the custom providers environments list output pagination type.
type CustomProvidersEnvironmentsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// CustomProvidersEnvironmentsListOutput represents the custom providers environments list output type.
type CustomProvidersEnvironmentsListOutput struct {
	Items      []CustomProvidersEnvironmentsListOutputItems    `json:"items"`
	Pagination CustomProvidersEnvironmentsListOutputPagination `json:"pagination"`
}

// MapCustomProvidersEnvironmentsListOutputFromJSON deserializes JSON data into a CustomProvidersEnvironmentsListOutput.
func MapCustomProvidersEnvironmentsListOutputFromJSON(data []byte) (*CustomProvidersEnvironmentsListOutput, error) {
	var v CustomProvidersEnvironmentsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersEnvironmentsListOutputToJSON serializes a CustomProvidersEnvironmentsListOutput to JSON.
func MapCustomProvidersEnvironmentsListOutputToJSON(v *CustomProvidersEnvironmentsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CustomProvidersEnvironmentsListQuery represents the custom providers environments list query type.
type CustomProvidersEnvironmentsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by environment IDs
	Id *any `json:"id,omitempty"`
	// CustomProviderVersionId - Filter by version IDs
	CustomProviderVersionId *any `json:"custom_provider_version_id,omitempty"`
	// CustomProviderId - Filter by custom provider IDs
	CustomProviderId *any `json:"custom_provider_id,omitempty"`
}

// MapCustomProvidersEnvironmentsListQueryFromJSON deserializes JSON data into a CustomProvidersEnvironmentsListQuery.
func MapCustomProvidersEnvironmentsListQueryFromJSON(data []byte) (*CustomProvidersEnvironmentsListQuery, error) {
	var v CustomProvidersEnvironmentsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersEnvironmentsListQueryToJSON serializes a CustomProvidersEnvironmentsListQuery to JSON.
func MapCustomProvidersEnvironmentsListQueryToJSON(v *CustomProvidersEnvironmentsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
