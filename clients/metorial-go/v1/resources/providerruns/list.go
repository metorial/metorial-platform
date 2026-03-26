package providerruns

import (
	"encoding/json"
	"time"
)

// ProviderRunsListOutputItems represents the provider runs list output items type.
type ProviderRunsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider run identifier
	Id string `json:"id"`
	// Status - Run status
	Status string `json:"status"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// SessionProviderId - Session provider ID
	SessionProviderId string `json:"session_provider_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ConnectionId - Connection ID
	ConnectionId string `json:"connection_id"`
	// CompletedAt - Timestamp when run completed
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderRunsListOutputPagination represents the provider runs list output pagination type.
type ProviderRunsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderRunsListOutput represents the provider runs list output type.
type ProviderRunsListOutput struct {
	Items      []ProviderRunsListOutputItems    `json:"items"`
	Pagination ProviderRunsListOutputPagination `json:"pagination"`
}

// MapProviderRunsListOutputFromJSON deserializes JSON data into a ProviderRunsListOutput.
func MapProviderRunsListOutputFromJSON(data []byte) (*ProviderRunsListOutput, error) {
	var v ProviderRunsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderRunsListOutputToJSON serializes a ProviderRunsListOutput to JSON.
func MapProviderRunsListOutputToJSON(v *ProviderRunsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderRunsListQuery represents the provider runs list query type.
type ProviderRunsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by run status
	Status *any `json:"status,omitempty"`
	// Id - Filter by provider run ID(s)
	Id *any `json:"id,omitempty"`
	// SessionId - Filter by session ID(s)
	SessionId *any `json:"session_id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// SessionProviderId - Filter by session provider ID(s)
	SessionProviderId *any `json:"session_provider_id,omitempty"`
	// SessionConnectionId - Filter by session connection ID(s)
	SessionConnectionId *any `json:"session_connection_id,omitempty"`
	// ProviderVersionId - Filter by provider version ID(s)
	ProviderVersionId *any `json:"provider_version_id,omitempty"`
}

// MapProviderRunsListQueryFromJSON deserializes JSON data into a ProviderRunsListQuery.
func MapProviderRunsListQueryFromJSON(data []byte) (*ProviderRunsListQuery, error) {
	var v ProviderRunsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderRunsListQueryToJSON serializes a ProviderRunsListQuery to JSON.
func MapProviderRunsListQueryToJSON(v *ProviderRunsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
