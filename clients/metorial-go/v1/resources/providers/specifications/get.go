package specifications

import (
	"encoding/json"
	"time"
)

// ProvidersSpecificationsGetOutputToolsInputSchema represents the providers specifications get output tools input schema type.
type ProvidersSpecificationsGetOutputToolsInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool input parameters
	Schema map[string]any `json:"schema"`
}

// ProvidersSpecificationsGetOutputToolsOutputSchema represents the providers specifications get output tools output schema type.
type ProvidersSpecificationsGetOutputToolsOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool output format
	Schema map[string]any `json:"schema"`
}

// ProvidersSpecificationsGetOutputToolsTags represents the providers specifications get output tools tags type.
type ProvidersSpecificationsGetOutputToolsTags struct {
	// Destructive - Whether the tool is destructive
	Destructive *bool `json:"destructive,omitempty"`
	// ReadOnly - Whether the tool is read-only
	ReadOnly *bool `json:"read_only,omitempty"`
}

// ProvidersSpecificationsGetOutputTools represents the providers specifications get output tools type.
type ProvidersSpecificationsGetOutputTools struct {
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
	Instructions []string                                           `json:"instructions"`
	InputSchema  *ProvidersSpecificationsGetOutputToolsInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProvidersSpecificationsGetOutputToolsOutputSchema `json:"output_schema,omitempty"`
	Tags         *ProvidersSpecificationsGetOutputToolsTags         `json:"tags,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId string `json:"specification_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProvidersSpecificationsGetOutputAuthMethodsInputSchema represents the providers specifications get output auth methods input schema type.
type ProvidersSpecificationsGetOutputAuthMethodsInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProvidersSpecificationsGetOutputAuthMethodsOutputSchema represents the providers specifications get output auth methods output schema type.
type ProvidersSpecificationsGetOutputAuthMethodsOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProvidersSpecificationsGetOutputAuthMethodsScopes represents the providers specifications get output auth methods scopes type.
type ProvidersSpecificationsGetOutputAuthMethodsScopes struct {
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

// ProvidersSpecificationsGetOutputAuthMethods represents the providers specifications get output auth methods type.
type ProvidersSpecificationsGetOutputAuthMethods struct {
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
	Capabilities map[string]any                                           `json:"capabilities"`
	InputSchema  *ProvidersSpecificationsGetOutputAuthMethodsInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProvidersSpecificationsGetOutputAuthMethodsOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProvidersSpecificationsGetOutputAuthMethodsScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProvidersSpecificationsGetOutput represents the providers specifications get output type.
type ProvidersSpecificationsGetOutput struct {
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
	Tools []ProvidersSpecificationsGetOutputTools `json:"tools"`
	// AuthMethods - Authentication methods
	AuthMethods []ProvidersSpecificationsGetOutputAuthMethods `json:"auth_methods"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProvidersSpecificationsGetOutputFromJSON deserializes JSON data into a ProvidersSpecificationsGetOutput.
func MapProvidersSpecificationsGetOutputFromJSON(data []byte) (*ProvidersSpecificationsGetOutput, error) {
	var v ProvidersSpecificationsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersSpecificationsGetOutputToJSON serializes a ProvidersSpecificationsGetOutput to JSON.
func MapProvidersSpecificationsGetOutputToJSON(v *ProvidersSpecificationsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
