package tools

import (
	"encoding/json"
	"time"
)

// ProvidersToolsListOutputItemsInputSchema represents the providers tools list output items input schema type.
type ProvidersToolsListOutputItemsInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool input parameters
	Schema map[string]any `json:"schema"`
}

// ProvidersToolsListOutputItemsOutputSchema represents the providers tools list output items output schema type.
type ProvidersToolsListOutputItemsOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool output format
	Schema map[string]any `json:"schema"`
}

// ProvidersToolsListOutputItemsTags represents the providers tools list output items tags type.
type ProvidersToolsListOutputItemsTags struct {
	// Destructive - Whether the tool is destructive
	Destructive *bool `json:"destructive,omitempty"`
	// ReadOnly - Whether the tool is read-only
	ReadOnly *bool `json:"read_only,omitempty"`
}

// ProvidersToolsListOutputItems represents the providers tools list output items type.
type ProvidersToolsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique tool identifier
	Id string `json:"id"`
	// Key - Tool key
	Key string `json:"key"`
	// Name - Display name of the tool
	Name string `json:"name"`
	// Description - Tool description
	Description *string `json:"description,omitempty"`
	// Capabilities - Tool capabilities
	Capabilities map[string]any `json:"capabilities"`
	// Constraints - Tool constraints
	Constraints []string `json:"constraints"`
	// Instructions - Tool usage instructions
	Instructions []string                                   `json:"instructions"`
	InputSchema  *ProvidersToolsListOutputItemsInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProvidersToolsListOutputItemsOutputSchema `json:"output_schema,omitempty"`
	Tags         *ProvidersToolsListOutputItemsTags         `json:"tags,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId string `json:"specification_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProvidersToolsListOutputPagination represents the providers tools list output pagination type.
type ProvidersToolsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProvidersToolsListOutput represents the providers tools list output type.
type ProvidersToolsListOutput struct {
	Items      []ProvidersToolsListOutputItems    `json:"items"`
	Pagination ProvidersToolsListOutputPagination `json:"pagination"`
}

// MapProvidersToolsListOutputFromJSON deserializes JSON data into a ProvidersToolsListOutput.
func MapProvidersToolsListOutputFromJSON(data []byte) (*ProvidersToolsListOutput, error) {
	var v ProvidersToolsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersToolsListOutputToJSON serializes a ProvidersToolsListOutput to JSON.
func MapProvidersToolsListOutputToJSON(v *ProvidersToolsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProvidersToolsListQuery represents the providers tools list query type.
type ProvidersToolsListQuery struct {
	Limit             *float64 `json:"limit,omitempty"`
	After             *string  `json:"after,omitempty"`
	Before            *string  `json:"before,omitempty"`
	Cursor            *string  `json:"cursor,omitempty"`
	Order             *string  `json:"order,omitempty"`
	ProviderVersionId string   `json:"provider_version_id"`
}

// MapProvidersToolsListQueryFromJSON deserializes JSON data into a ProvidersToolsListQuery.
func MapProvidersToolsListQueryFromJSON(data []byte) (*ProvidersToolsListQuery, error) {
	var v ProvidersToolsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersToolsListQueryToJSON serializes a ProvidersToolsListQuery to JSON.
func MapProvidersToolsListQueryToJSON(v *ProvidersToolsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
