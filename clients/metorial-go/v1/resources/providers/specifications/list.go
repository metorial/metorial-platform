package specifications

import (
	"encoding/json"
	"time"
)

// ProvidersSpecificationsListOutputItemsToolsInputSchema represents the providers specifications list output items tools input schema type.
type ProvidersSpecificationsListOutputItemsToolsInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool input parameters
	Schema map[string]any `json:"schema"`
}

// ProvidersSpecificationsListOutputItemsToolsOutputSchema represents the providers specifications list output items tools output schema type.
type ProvidersSpecificationsListOutputItemsToolsOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool output format
	Schema map[string]any `json:"schema"`
}

// ProvidersSpecificationsListOutputItemsToolsTags represents the providers specifications list output items tools tags type.
type ProvidersSpecificationsListOutputItemsToolsTags struct {
	// Destructive - Whether the tool is destructive
	Destructive *bool `json:"destructive,omitempty"`
	// ReadOnly - Whether the tool is read-only
	ReadOnly *bool `json:"read_only,omitempty"`
}

// ProvidersSpecificationsListOutputItemsTools represents the providers specifications list output items tools type.
type ProvidersSpecificationsListOutputItemsTools struct {
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
	Instructions []string                                                 `json:"instructions"`
	InputSchema  *ProvidersSpecificationsListOutputItemsToolsInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProvidersSpecificationsListOutputItemsToolsOutputSchema `json:"output_schema,omitempty"`
	Tags         *ProvidersSpecificationsListOutputItemsToolsTags         `json:"tags,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId string `json:"specification_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProvidersSpecificationsListOutputItemsAuthMethodsInputSchema represents the providers specifications list output items auth methods input schema type.
type ProvidersSpecificationsListOutputItemsAuthMethodsInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProvidersSpecificationsListOutputItemsAuthMethodsOutputSchema represents the providers specifications list output items auth methods output schema type.
type ProvidersSpecificationsListOutputItemsAuthMethodsOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProvidersSpecificationsListOutputItemsAuthMethodsScopes represents the providers specifications list output items auth methods scopes type.
type ProvidersSpecificationsListOutputItemsAuthMethodsScopes struct {
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

// ProvidersSpecificationsListOutputItemsAuthMethods represents the providers specifications list output items auth methods type.
type ProvidersSpecificationsListOutputItemsAuthMethods struct {
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
	Capabilities map[string]any                                                 `json:"capabilities"`
	InputSchema  *ProvidersSpecificationsListOutputItemsAuthMethodsInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProvidersSpecificationsListOutputItemsAuthMethodsOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProvidersSpecificationsListOutputItemsAuthMethodsScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProvidersSpecificationsListOutputItems represents the providers specifications list output items type.
type ProvidersSpecificationsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique specification identifier
	Id string `json:"id"`
	// Key - Unique specification key
	Key string `json:"key"`
	// Name - Display name
	Name string `json:"name"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// ConfigSchema - JSON Schema defining the configuration structure
	ConfigSchema map[string]any `json:"config_schema"`
	// ConfigVisibility - Visibility level of the configuration
	ConfigVisibility string `json:"config_visibility"`
	// Tools - Available tools
	Tools []ProvidersSpecificationsListOutputItemsTools `json:"tools"`
	// AuthMethods - Authentication methods
	AuthMethods []ProvidersSpecificationsListOutputItemsAuthMethods `json:"auth_methods"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProvidersSpecificationsListOutputPagination represents the providers specifications list output pagination type.
type ProvidersSpecificationsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProvidersSpecificationsListOutput represents the providers specifications list output type.
type ProvidersSpecificationsListOutput struct {
	Items      []ProvidersSpecificationsListOutputItems    `json:"items"`
	Pagination ProvidersSpecificationsListOutputPagination `json:"pagination"`
}

// MapProvidersSpecificationsListOutputFromJSON deserializes JSON data into a ProvidersSpecificationsListOutput.
func MapProvidersSpecificationsListOutputFromJSON(data []byte) (*ProvidersSpecificationsListOutput, error) {
	var v ProvidersSpecificationsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersSpecificationsListOutputToJSON serializes a ProvidersSpecificationsListOutput to JSON.
func MapProvidersSpecificationsListOutputToJSON(v *ProvidersSpecificationsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProvidersSpecificationsListQuery represents the providers specifications list query type.
type ProvidersSpecificationsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by specification ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderVersionId - Filter by provider version ID(s)
	ProviderVersionId *any `json:"provider_version_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderConfigId - Filter by provider config ID(s)
	ProviderConfigId *any `json:"provider_config_id,omitempty"`
}

// MapProvidersSpecificationsListQueryFromJSON deserializes JSON data into a ProvidersSpecificationsListQuery.
func MapProvidersSpecificationsListQueryFromJSON(data []byte) (*ProvidersSpecificationsListQuery, error) {
	var v ProvidersSpecificationsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersSpecificationsListQueryToJSON serializes a ProvidersSpecificationsListQuery to JSON.
func MapProvidersSpecificationsListQueryToJSON(v *ProvidersSpecificationsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
