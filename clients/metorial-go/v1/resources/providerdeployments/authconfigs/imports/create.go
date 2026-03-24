package imports

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigDeploymentPreview represents the provider deployments auth configs imports create output auth config deployment preview type.
type ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigDeploymentPreview struct {
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

// ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigCredentials represents the provider deployments auth configs imports create output auth config credentials type.
type ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigCredentials struct {
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

// ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigAuthMethodInputSchema represents the provider deployments auth configs imports create output auth config auth method input schema type.
type ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigAuthMethodOutputSchema represents the provider deployments auth configs imports create output auth config auth method output schema type.
type ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigAuthMethodScopes represents the provider deployments auth configs imports create output auth config auth method scopes type.
type ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigAuthMethodScopes struct {
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

// ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigAuthMethod represents the provider deployments auth configs imports create output auth config auth method type.
type ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigAuthMethod struct {
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
	Capabilities map[string]any                                                                     `json:"capabilities"`
	InputSchema  *ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfig represents the provider deployments auth configs imports create output auth config type.
type ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfig struct {
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
	Metadata          *map[string]any                                                               `json:"metadata,omitempty"`
	DeploymentPreview *ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigDeploymentPreview `json:"deployment_preview,omitempty"`
	Credentials       *ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigCredentials       `json:"credentials,omitempty"`
	AuthMethod        ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfigAuthMethod         `json:"auth_method"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsImportsCreateOutput represents the provider deployments auth configs imports create output type.
type ProviderDeploymentsAuthConfigsImportsCreateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique auth import identifier
	Id string `json:"id"`
	// Note - Note explaining the import
	Note string `json:"note"`
	// Ip - IP address of the import request
	Ip *string `json:"ip,omitempty"`
	// UserAgent - User agent of the import request
	UserAgent *string `json:"user_agent,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata   *map[string]any                                             `json:"metadata,omitempty"`
	AuthConfig ProviderDeploymentsAuthConfigsImportsCreateOutputAuthConfig `json:"auth_config"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderDeploymentId - Deployment ID
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	// AuthMethodId - Auth method ID
	AuthMethodId string `json:"auth_method_id"`
	// CredentialsId - Auth credentials ID
	CredentialsId *string `json:"credentials_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// ExpiresAt - Timestamp when the import expires
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// MapProviderDeploymentsAuthConfigsImportsCreateOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsImportsCreateOutput.
func MapProviderDeploymentsAuthConfigsImportsCreateOutputFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsImportsCreateOutput, error) {
	var v ProviderDeploymentsAuthConfigsImportsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsImportsCreateOutputToJSON serializes a ProviderDeploymentsAuthConfigsImportsCreateOutput to JSON.
func MapProviderDeploymentsAuthConfigsImportsCreateOutputToJSON(v *ProviderDeploymentsAuthConfigsImportsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsAuthConfigsImportsCreateBody represents the provider deployments auth configs imports create body type.
type ProviderDeploymentsAuthConfigsImportsCreateBody struct {
	ProviderId           *string `json:"provider_id,omitempty"`
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	ProviderAuthConfigId *string `json:"provider_auth_config_id,omitempty"`
	// ProviderAuthMethodId - The authentication method used by these credentials
	ProviderAuthMethodId *string `json:"provider_auth_method_id,omitempty"`
	// Note - A note describing the import source or reason
	Note string `json:"note"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Value - The credential data to import
	Value map[string]any `json:"value"`
}

// MapProviderDeploymentsAuthConfigsImportsCreateBodyFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsImportsCreateBody.
func MapProviderDeploymentsAuthConfigsImportsCreateBodyFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsImportsCreateBody, error) {
	var v ProviderDeploymentsAuthConfigsImportsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsImportsCreateBodyToJSON serializes a ProviderDeploymentsAuthConfigsImportsCreateBody to JSON.
func MapProviderDeploymentsAuthConfigsImportsCreateBodyToJSON(v *ProviderDeploymentsAuthConfigsImportsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
