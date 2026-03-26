package exports

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigDeploymentPreview represents the provider deployments auth configs exports get output auth config deployment preview type.
type ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigDeploymentPreview struct {
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

// ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigCredentials represents the provider deployments auth configs exports get output auth config credentials type.
type ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigCredentials struct {
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

// ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigAuthMethodInputSchema represents the provider deployments auth configs exports get output auth config auth method input schema type.
type ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigAuthMethodOutputSchema represents the provider deployments auth configs exports get output auth config auth method output schema type.
type ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigAuthMethodScopes represents the provider deployments auth configs exports get output auth config auth method scopes type.
type ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigAuthMethodScopes struct {
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

// ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigAuthMethod represents the provider deployments auth configs exports get output auth config auth method type.
type ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigAuthMethod struct {
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
	Capabilities map[string]any                                                                  `json:"capabilities"`
	InputSchema  *ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfig represents the provider deployments auth configs exports get output auth config type.
type ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfig struct {
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
	Metadata          *map[string]any                                                            `json:"metadata,omitempty"`
	DeploymentPreview *ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigDeploymentPreview `json:"deployment_preview,omitempty"`
	Credentials       *ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigCredentials       `json:"credentials,omitempty"`
	AuthMethod        ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfigAuthMethod         `json:"auth_method"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsExportsGetOutput represents the provider deployments auth configs exports get output type.
type ProviderDeploymentsAuthConfigsExportsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique auth export identifier
	Id string `json:"id"`
	// Note - Note explaining the export reason
	Note string `json:"note"`
	// Ip - IP address of the export request
	Ip *string `json:"ip,omitempty"`
	// UserAgent - User agent of the export request
	UserAgent *string `json:"user_agent,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata   *map[string]any                                          `json:"metadata,omitempty"`
	AuthConfig ProviderDeploymentsAuthConfigsExportsGetOutputAuthConfig `json:"auth_config"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderDeploymentId - Deployment ID
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	// AuthMethodId - Auth method ID
	AuthMethodId string `json:"auth_method_id"`
	// CredentialsId - Auth credentials ID
	CredentialsId *string `json:"credentials_id,omitempty"`
	// Value - The exported credential data
	Value *map[string]any `json:"value,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// ExpiresAt - Timestamp when the export expires
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// MapProviderDeploymentsAuthConfigsExportsGetOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsExportsGetOutput.
func MapProviderDeploymentsAuthConfigsExportsGetOutputFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsExportsGetOutput, error) {
	var v ProviderDeploymentsAuthConfigsExportsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsExportsGetOutputToJSON serializes a ProviderDeploymentsAuthConfigsExportsGetOutput to JSON.
func MapProviderDeploymentsAuthConfigsExportsGetOutputToJSON(v *ProviderDeploymentsAuthConfigsExportsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
