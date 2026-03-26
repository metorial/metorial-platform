package versions

import (
	"encoding/json"
	"time"
)

// ProvidersVersionsListOutputItems represents the providers versions list output items type.
type ProvidersVersionsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique version identifier
	Id string `json:"id"`
	// Version - Version identifier string
	Version string `json:"version"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// IsCurrent - Whether this is the current version
	IsCurrent bool `json:"is_current"`
	// Name - Version name
	Name string `json:"name"`
	// Description - Version description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId *string `json:"specification_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProvidersVersionsListOutputPagination represents the providers versions list output pagination type.
type ProvidersVersionsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProvidersVersionsListOutput represents the providers versions list output type.
type ProvidersVersionsListOutput struct {
	Items      []ProvidersVersionsListOutputItems    `json:"items"`
	Pagination ProvidersVersionsListOutputPagination `json:"pagination"`
}

// MapProvidersVersionsListOutputFromJSON deserializes JSON data into a ProvidersVersionsListOutput.
func MapProvidersVersionsListOutputFromJSON(data []byte) (*ProvidersVersionsListOutput, error) {
	var v ProvidersVersionsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersVersionsListOutputToJSON serializes a ProvidersVersionsListOutput to JSON.
func MapProvidersVersionsListOutputToJSON(v *ProvidersVersionsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProvidersVersionsListQuery represents the providers versions list query type.
type ProvidersVersionsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by version ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
}

// MapProvidersVersionsListQueryFromJSON deserializes JSON data into a ProvidersVersionsListQuery.
func MapProvidersVersionsListQueryFromJSON(data []byte) (*ProvidersVersionsListQuery, error) {
	var v ProvidersVersionsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersVersionsListQueryToJSON serializes a ProvidersVersionsListQuery to JSON.
func MapProvidersVersionsListQueryToJSON(v *ProvidersVersionsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
