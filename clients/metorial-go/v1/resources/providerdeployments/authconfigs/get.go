package authconfigs

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthConfigsGetOutputDeploymentPreview represents the provider deployments auth configs get output deployment preview type.
type ProviderDeploymentsAuthConfigsGetOutputDeploymentPreview struct {
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

// ProviderDeploymentsAuthConfigsGetOutputCredentials represents the provider deployments auth configs get output credentials type.
type ProviderDeploymentsAuthConfigsGetOutputCredentials struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique credentials identifier
	Id   string `json:"id"`
	Type string `json:"type"`
	// IsDefault - Whether this is the default credentials for the provider
	IsDefault bool `json:"is_default"`
	// IsManaged - Whether these credentials are managed by Metorial
	IsManaged bool `json:"is_managed"`
	// Name - Display name
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

// ProviderDeploymentsAuthConfigsGetOutputAuthMethodInputSchema represents the provider deployments auth configs get output auth method input schema type.
type ProviderDeploymentsAuthConfigsGetOutputAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsGetOutputAuthMethodOutputSchema represents the provider deployments auth configs get output auth method output schema type.
type ProviderDeploymentsAuthConfigsGetOutputAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsGetOutputAuthMethodScopes represents the provider deployments auth configs get output auth method scopes type.
type ProviderDeploymentsAuthConfigsGetOutputAuthMethodScopes struct {
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

// ProviderDeploymentsAuthConfigsGetOutputAuthMethod represents the provider deployments auth configs get output auth method type.
type ProviderDeploymentsAuthConfigsGetOutputAuthMethod struct {
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
	InputSchema  *ProviderDeploymentsAuthConfigsGetOutputAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsAuthConfigsGetOutputAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsAuthConfigsGetOutputAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsGetOutput represents the provider deployments auth configs get output type.
type ProviderDeploymentsAuthConfigsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique auth config identifier
	Id string `json:"id"`
	// Type - Authentication type
	Type string `json:"type"`
	// Source - Auth config source
	Source string `json:"source"`
	// Status - Auth config status
	Status string `json:"status"`
	// IsDefault - Whether this is the default auth config
	IsDefault bool `json:"is_default"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// Name - Display name
	Name *string `json:"name,omitempty"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata          *map[string]any                                           `json:"metadata,omitempty"`
	DeploymentPreview *ProviderDeploymentsAuthConfigsGetOutputDeploymentPreview `json:"deployment_preview,omitempty"`
	Credentials       *ProviderDeploymentsAuthConfigsGetOutputCredentials       `json:"credentials,omitempty"`
	AuthMethod        ProviderDeploymentsAuthConfigsGetOutputAuthMethod         `json:"auth_method"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsAuthConfigsGetOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsGetOutput.
func MapProviderDeploymentsAuthConfigsGetOutputFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsGetOutput, error) {
	var v ProviderDeploymentsAuthConfigsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsGetOutputToJSON serializes a ProviderDeploymentsAuthConfigsGetOutput to JSON.
func MapProviderDeploymentsAuthConfigsGetOutputToJSON(v *ProviderDeploymentsAuthConfigsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
