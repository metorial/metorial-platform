package setupsessions

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsSetupSessionsGetOutputAuthMethodInputSchema represents the provider deployments setup sessions get output auth method input schema type.
type ProviderDeploymentsSetupSessionsGetOutputAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsSetupSessionsGetOutputAuthMethodOutputSchema represents the provider deployments setup sessions get output auth method output schema type.
type ProviderDeploymentsSetupSessionsGetOutputAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsSetupSessionsGetOutputAuthMethodScopes represents the provider deployments setup sessions get output auth method scopes type.
type ProviderDeploymentsSetupSessionsGetOutputAuthMethodScopes struct {
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

// ProviderDeploymentsSetupSessionsGetOutputAuthMethod represents the provider deployments setup sessions get output auth method type.
type ProviderDeploymentsSetupSessionsGetOutputAuthMethod struct {
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
	Capabilities map[string]any                                                   `json:"capabilities"`
	InputSchema  *ProviderDeploymentsSetupSessionsGetOutputAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsSetupSessionsGetOutputAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsSetupSessionsGetOutputAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsGetOutputDeployment represents the provider deployments setup sessions get output deployment type.
type ProviderDeploymentsSetupSessionsGetOutputDeployment struct {
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

// ProviderDeploymentsSetupSessionsGetOutputCredentials represents the provider deployments setup sessions get output credentials type.
type ProviderDeploymentsSetupSessionsGetOutputCredentials struct {
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

// ProviderDeploymentsSetupSessionsGetOutputAuthConfigDeploymentPreview represents the provider deployments setup sessions get output auth config deployment preview type.
type ProviderDeploymentsSetupSessionsGetOutputAuthConfigDeploymentPreview struct {
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

// ProviderDeploymentsSetupSessionsGetOutputAuthConfigCredentials represents the provider deployments setup sessions get output auth config credentials type.
type ProviderDeploymentsSetupSessionsGetOutputAuthConfigCredentials struct {
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

// ProviderDeploymentsSetupSessionsGetOutputAuthConfigAuthMethodInputSchema represents the provider deployments setup sessions get output auth config auth method input schema type.
type ProviderDeploymentsSetupSessionsGetOutputAuthConfigAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsSetupSessionsGetOutputAuthConfigAuthMethodOutputSchema represents the provider deployments setup sessions get output auth config auth method output schema type.
type ProviderDeploymentsSetupSessionsGetOutputAuthConfigAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsSetupSessionsGetOutputAuthConfigAuthMethodScopes represents the provider deployments setup sessions get output auth config auth method scopes type.
type ProviderDeploymentsSetupSessionsGetOutputAuthConfigAuthMethodScopes struct {
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

// ProviderDeploymentsSetupSessionsGetOutputAuthConfigAuthMethod represents the provider deployments setup sessions get output auth config auth method type.
type ProviderDeploymentsSetupSessionsGetOutputAuthConfigAuthMethod struct {
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
	Capabilities map[string]any                                                             `json:"capabilities"`
	InputSchema  *ProviderDeploymentsSetupSessionsGetOutputAuthConfigAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsSetupSessionsGetOutputAuthConfigAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsSetupSessionsGetOutputAuthConfigAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsGetOutputAuthConfig represents the provider deployments setup sessions get output auth config type.
type ProviderDeploymentsSetupSessionsGetOutputAuthConfig struct {
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
	Metadata          *map[string]any                                                       `json:"metadata,omitempty"`
	DeploymentPreview *ProviderDeploymentsSetupSessionsGetOutputAuthConfigDeploymentPreview `json:"deployment_preview,omitempty"`
	Credentials       *ProviderDeploymentsSetupSessionsGetOutputAuthConfigCredentials       `json:"credentials,omitempty"`
	AuthMethod        ProviderDeploymentsSetupSessionsGetOutputAuthConfigAuthMethod         `json:"auth_method"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsGetOutputConfigDeployment represents the provider deployments setup sessions get output config deployment type.
type ProviderDeploymentsSetupSessionsGetOutputConfigDeployment struct {
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

// ProviderDeploymentsSetupSessionsGetOutputConfigFromVaultDeployment represents the provider deployments setup sessions get output config from vault deployment type.
type ProviderDeploymentsSetupSessionsGetOutputConfigFromVaultDeployment struct {
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

// ProviderDeploymentsSetupSessionsGetOutputConfigFromVault represents the provider deployments setup sessions get output config from vault type.
type ProviderDeploymentsSetupSessionsGetOutputConfigFromVault struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique config vault identifier
	Id string `json:"id"`
	// Name - Display name
	Name string `json:"name"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderId - Provider ID
	ProviderId string                                                              `json:"provider_id"`
	Deployment *ProviderDeploymentsSetupSessionsGetOutputConfigFromVaultDeployment `json:"deployment,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsGetOutputConfig represents the provider deployments setup sessions get output config type.
type ProviderDeploymentsSetupSessionsGetOutputConfig struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique config identifier
	Id string `json:"id"`
	// IsDefault - Whether this is the default config
	IsDefault bool `json:"is_default"`
	// Name - Display name
	Name *string `json:"name,omitempty"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SpecificationId - Specification ID
	SpecificationId string                                                     `json:"specification_id"`
	Deployment      *ProviderDeploymentsSetupSessionsGetOutputConfigDeployment `json:"deployment,omitempty"`
	FromVault       *ProviderDeploymentsSetupSessionsGetOutputConfigFromVault  `json:"from_vault,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsGetOutput represents the provider deployments setup sessions get output type.
type ProviderDeploymentsSetupSessionsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique setup session identifier
	Id string `json:"id"`
	// Type - Setup session type
	Type string `json:"type"`
	// Status - Session status
	Status string `json:"status"`
	// Url - URL where user completes authentication
	Url string `json:"url"`
	// Name - Display name
	Name *string `json:"name,omitempty"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderId - Provider ID
	ProviderId  string                                                `json:"provider_id"`
	AuthMethod  ProviderDeploymentsSetupSessionsGetOutputAuthMethod   `json:"auth_method"`
	Deployment  *ProviderDeploymentsSetupSessionsGetOutputDeployment  `json:"deployment,omitempty"`
	Credentials *ProviderDeploymentsSetupSessionsGetOutputCredentials `json:"credentials,omitempty"`
	AuthConfig  *ProviderDeploymentsSetupSessionsGetOutputAuthConfig  `json:"auth_config,omitempty"`
	Config      *ProviderDeploymentsSetupSessionsGetOutputConfig      `json:"config,omitempty"`
	// UiMode - UI mode for setup
	UiMode string `json:"ui_mode"`
	// RedirectUrl - URL to redirect after setup
	RedirectUrl *string `json:"redirect_url,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
	// ExpiresAt - Timestamp when the session expires
	ExpiresAt time.Time `json:"expires_at"`
}

// MapProviderDeploymentsSetupSessionsGetOutputFromJSON deserializes JSON data into a ProviderDeploymentsSetupSessionsGetOutput.
func MapProviderDeploymentsSetupSessionsGetOutputFromJSON(data []byte) (*ProviderDeploymentsSetupSessionsGetOutput, error) {
	var v ProviderDeploymentsSetupSessionsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsSetupSessionsGetOutputToJSON serializes a ProviderDeploymentsSetupSessionsGetOutput to JSON.
func MapProviderDeploymentsSetupSessionsGetOutputToJSON(v *ProviderDeploymentsSetupSessionsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
