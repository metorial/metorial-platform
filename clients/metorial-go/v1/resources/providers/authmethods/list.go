package authmethods

import (
	"encoding/json"
	"time"
)

// ProvidersAuthMethodsListOutputItemsInputSchema represents the providers auth methods list output items input schema type.
type ProvidersAuthMethodsListOutputItemsInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProvidersAuthMethodsListOutputItemsOutputSchema represents the providers auth methods list output items output schema type.
type ProvidersAuthMethodsListOutputItemsOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProvidersAuthMethodsListOutputItemsScopes represents the providers auth methods list output items scopes type.
type ProvidersAuthMethodsListOutputItemsScopes struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique scope identifier
	Id string `json:"id"`
	// Scope - OAuth scope string
	Scope string `json:"scope"`
	// Name - Display name of the scope
	Name string `json:"name"`
	// Description - Scope description
	Description *string `json:"description,omitempty"`
}

// ProvidersAuthMethodsListOutputItems represents the providers auth methods list output items type.
type ProvidersAuthMethodsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique auth method identifier
	Id string `json:"id"`
	// Type - Authentication type
	Type string `json:"type"`
	// Key - Auth method key
	Key string `json:"key"`
	// Name - Display name
	Name string `json:"name"`
	// Description - Auth method description
	Description *string `json:"description,omitempty"`
	// Capabilities - Auth method capabilities
	Capabilities map[string]any                                   `json:"capabilities"`
	InputSchema  *ProvidersAuthMethodsListOutputItemsInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProvidersAuthMethodsListOutputItemsOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProvidersAuthMethodsListOutputItemsScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProvidersAuthMethodsListOutputPagination represents the providers auth methods list output pagination type.
type ProvidersAuthMethodsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProvidersAuthMethodsListOutput represents the providers auth methods list output type.
type ProvidersAuthMethodsListOutput struct {
	Items      []ProvidersAuthMethodsListOutputItems    `json:"items"`
	Pagination ProvidersAuthMethodsListOutputPagination `json:"pagination"`
}

// MapProvidersAuthMethodsListOutputFromJSON deserializes JSON data into a ProvidersAuthMethodsListOutput.
func MapProvidersAuthMethodsListOutputFromJSON(data []byte) (*ProvidersAuthMethodsListOutput, error) {
	var v ProvidersAuthMethodsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersAuthMethodsListOutputToJSON serializes a ProvidersAuthMethodsListOutput to JSON.
func MapProvidersAuthMethodsListOutputToJSON(v *ProvidersAuthMethodsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProvidersAuthMethodsListQuery represents the providers auth methods list query type.
type ProvidersAuthMethodsListQuery struct {
	Limit             *float64 `json:"limit,omitempty"`
	After             *string  `json:"after,omitempty"`
	Before            *string  `json:"before,omitempty"`
	Cursor            *string  `json:"cursor,omitempty"`
	Order             *string  `json:"order,omitempty"`
	ProviderVersionId string   `json:"provider_version_id"`
}

// MapProvidersAuthMethodsListQueryFromJSON deserializes JSON data into a ProvidersAuthMethodsListQuery.
func MapProvidersAuthMethodsListQueryFromJSON(data []byte) (*ProvidersAuthMethodsListQuery, error) {
	var v ProvidersAuthMethodsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersAuthMethodsListQueryToJSON serializes a ProvidersAuthMethodsListQuery to JSON.
func MapProvidersAuthMethodsListQueryToJSON(v *ProvidersAuthMethodsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
