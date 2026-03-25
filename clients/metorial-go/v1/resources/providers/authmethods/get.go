package authmethods

import (
	"encoding/json"
	"time"
)

// ProvidersAuthMethodsGetOutputInputSchema represents the providers auth methods get output input schema type.
type ProvidersAuthMethodsGetOutputInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProvidersAuthMethodsGetOutputOutputSchema represents the providers auth methods get output output schema type.
type ProvidersAuthMethodsGetOutputOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProvidersAuthMethodsGetOutputScopes represents the providers auth methods get output scopes type.
type ProvidersAuthMethodsGetOutputScopes struct {
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

// ProvidersAuthMethodsGetOutput represents the providers auth methods get output type.
type ProvidersAuthMethodsGetOutput struct {
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
	Capabilities map[string]any                             `json:"capabilities"`
	InputSchema  *ProvidersAuthMethodsGetOutputInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProvidersAuthMethodsGetOutputOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProvidersAuthMethodsGetOutputScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProvidersAuthMethodsGetOutputFromJSON deserializes JSON data into a ProvidersAuthMethodsGetOutput.
func MapProvidersAuthMethodsGetOutputFromJSON(data []byte) (*ProvidersAuthMethodsGetOutput, error) {
	var v ProvidersAuthMethodsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersAuthMethodsGetOutputToJSON serializes a ProvidersAuthMethodsGetOutput to JSON.
func MapProvidersAuthMethodsGetOutputToJSON(v *ProvidersAuthMethodsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
