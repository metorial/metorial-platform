package exports

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigDeploymentPreview represents the provider deployments auth configs exports create output auth config deployment preview type.
type ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigDeploymentPreview struct {
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

// ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigCredentials represents the provider deployments auth configs exports create output auth config credentials type.
type ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigCredentials struct {
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

// ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigAuthMethodInputSchema represents the provider deployments auth configs exports create output auth config auth method input schema type.
type ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigAuthMethodOutputSchema represents the provider deployments auth configs exports create output auth config auth method output schema type.
type ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigAuthMethodScopes represents the provider deployments auth configs exports create output auth config auth method scopes type.
type ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigAuthMethodScopes struct {
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

// ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigAuthMethod represents the provider deployments auth configs exports create output auth config auth method type.
type ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigAuthMethod struct {
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
	InputSchema  *ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfig represents the provider deployments auth configs exports create output auth config type.
type ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfig struct {
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
	DeploymentPreview *ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigDeploymentPreview `json:"deployment_preview,omitempty"`
	Credentials       *ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigCredentials       `json:"credentials,omitempty"`
	AuthMethod        ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfigAuthMethod         `json:"auth_method"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsExportsCreateOutput represents the provider deployments auth configs exports create output type.
type ProviderDeploymentsAuthConfigsExportsCreateOutput struct {
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
	Metadata   *map[string]any                                             `json:"metadata,omitempty"`
	AuthConfig ProviderDeploymentsAuthConfigsExportsCreateOutputAuthConfig `json:"auth_config"`
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

// MapProviderDeploymentsAuthConfigsExportsCreateOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsExportsCreateOutput.
func MapProviderDeploymentsAuthConfigsExportsCreateOutputFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsExportsCreateOutput, error) {
	var v ProviderDeploymentsAuthConfigsExportsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsExportsCreateOutputToJSON serializes a ProviderDeploymentsAuthConfigsExportsCreateOutput to JSON.
func MapProviderDeploymentsAuthConfigsExportsCreateOutputToJSON(v *ProviderDeploymentsAuthConfigsExportsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsAuthConfigsExportsCreateBody represents the provider deployments auth configs exports create body type.
type ProviderDeploymentsAuthConfigsExportsCreateBody struct {
	// ProviderAuthConfigId - Provider auth config ID
	ProviderAuthConfigId string `json:"provider_auth_config_id"`
	Note                 string `json:"note"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// MapProviderDeploymentsAuthConfigsExportsCreateBodyFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsExportsCreateBody.
func MapProviderDeploymentsAuthConfigsExportsCreateBodyFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsExportsCreateBody, error) {
	var v ProviderDeploymentsAuthConfigsExportsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsExportsCreateBodyToJSON serializes a ProviderDeploymentsAuthConfigsExportsCreateBody to JSON.
func MapProviderDeploymentsAuthConfigsExportsCreateBodyToJSON(v *ProviderDeploymentsAuthConfigsExportsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
