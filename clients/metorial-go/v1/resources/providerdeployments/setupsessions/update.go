package setupsessions

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsSetupSessionsUpdateOutputAuthMethodInputSchema represents the provider deployments setup sessions update output auth method input schema type.
type ProviderDeploymentsSetupSessionsUpdateOutputAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsSetupSessionsUpdateOutputAuthMethodOutputSchema represents the provider deployments setup sessions update output auth method output schema type.
type ProviderDeploymentsSetupSessionsUpdateOutputAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsSetupSessionsUpdateOutputAuthMethodScopes represents the provider deployments setup sessions update output auth method scopes type.
type ProviderDeploymentsSetupSessionsUpdateOutputAuthMethodScopes struct {
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

// ProviderDeploymentsSetupSessionsUpdateOutputAuthMethod represents the provider deployments setup sessions update output auth method type.
type ProviderDeploymentsSetupSessionsUpdateOutputAuthMethod struct {
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
	Capabilities map[string]any                                                      `json:"capabilities"`
	InputSchema  *ProviderDeploymentsSetupSessionsUpdateOutputAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsSetupSessionsUpdateOutputAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsSetupSessionsUpdateOutputAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsUpdateOutputDeployment represents the provider deployments setup sessions update output deployment type.
type ProviderDeploymentsSetupSessionsUpdateOutputDeployment struct {
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

// ProviderDeploymentsSetupSessionsUpdateOutputCredentials represents the provider deployments setup sessions update output credentials type.
type ProviderDeploymentsSetupSessionsUpdateOutputCredentials struct {
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

// ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigDeploymentPreview represents the provider deployments setup sessions update output auth config deployment preview type.
type ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigDeploymentPreview struct {
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

// ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigCredentials represents the provider deployments setup sessions update output auth config credentials type.
type ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigCredentials struct {
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

// ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigAuthMethodInputSchema represents the provider deployments setup sessions update output auth config auth method input schema type.
type ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigAuthMethodOutputSchema represents the provider deployments setup sessions update output auth config auth method output schema type.
type ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigAuthMethodScopes represents the provider deployments setup sessions update output auth config auth method scopes type.
type ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigAuthMethodScopes struct {
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

// ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigAuthMethod represents the provider deployments setup sessions update output auth config auth method type.
type ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigAuthMethod struct {
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
	Capabilities map[string]any                                                                `json:"capabilities"`
	InputSchema  *ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsUpdateOutputAuthConfig represents the provider deployments setup sessions update output auth config type.
type ProviderDeploymentsSetupSessionsUpdateOutputAuthConfig struct {
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
	Metadata          *map[string]any                                                          `json:"metadata,omitempty"`
	DeploymentPreview *ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigDeploymentPreview `json:"deployment_preview,omitempty"`
	Credentials       *ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigCredentials       `json:"credentials,omitempty"`
	AuthMethod        ProviderDeploymentsSetupSessionsUpdateOutputAuthConfigAuthMethod         `json:"auth_method"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsUpdateOutputConfigDeployment represents the provider deployments setup sessions update output config deployment type.
type ProviderDeploymentsSetupSessionsUpdateOutputConfigDeployment struct {
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

// ProviderDeploymentsSetupSessionsUpdateOutputConfigFromVaultDeployment represents the provider deployments setup sessions update output config from vault deployment type.
type ProviderDeploymentsSetupSessionsUpdateOutputConfigFromVaultDeployment struct {
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

// ProviderDeploymentsSetupSessionsUpdateOutputConfigFromVault represents the provider deployments setup sessions update output config from vault type.
type ProviderDeploymentsSetupSessionsUpdateOutputConfigFromVault struct {
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
	ProviderId string                                                                 `json:"provider_id"`
	Deployment *ProviderDeploymentsSetupSessionsUpdateOutputConfigFromVaultDeployment `json:"deployment,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsUpdateOutputConfig represents the provider deployments setup sessions update output config type.
type ProviderDeploymentsSetupSessionsUpdateOutputConfig struct {
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
	SpecificationId string                                                        `json:"specification_id"`
	Deployment      *ProviderDeploymentsSetupSessionsUpdateOutputConfigDeployment `json:"deployment,omitempty"`
	FromVault       *ProviderDeploymentsSetupSessionsUpdateOutputConfigFromVault  `json:"from_vault,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsUpdateOutput represents the provider deployments setup sessions update output type.
type ProviderDeploymentsSetupSessionsUpdateOutput struct {
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
	ProviderId  string                                                   `json:"provider_id"`
	AuthMethod  ProviderDeploymentsSetupSessionsUpdateOutputAuthMethod   `json:"auth_method"`
	Deployment  *ProviderDeploymentsSetupSessionsUpdateOutputDeployment  `json:"deployment,omitempty"`
	Credentials *ProviderDeploymentsSetupSessionsUpdateOutputCredentials `json:"credentials,omitempty"`
	AuthConfig  *ProviderDeploymentsSetupSessionsUpdateOutputAuthConfig  `json:"auth_config,omitempty"`
	Config      *ProviderDeploymentsSetupSessionsUpdateOutputConfig      `json:"config,omitempty"`
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

// MapProviderDeploymentsSetupSessionsUpdateOutputFromJSON deserializes JSON data into a ProviderDeploymentsSetupSessionsUpdateOutput.
func MapProviderDeploymentsSetupSessionsUpdateOutputFromJSON(data []byte) (*ProviderDeploymentsSetupSessionsUpdateOutput, error) {
	var v ProviderDeploymentsSetupSessionsUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsSetupSessionsUpdateOutputToJSON serializes a ProviderDeploymentsSetupSessionsUpdateOutput to JSON.
func MapProviderDeploymentsSetupSessionsUpdateOutputToJSON(v *ProviderDeploymentsSetupSessionsUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsSetupSessionsUpdateBody represents the provider deployments setup sessions update body type.
type ProviderDeploymentsSetupSessionsUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// MapProviderDeploymentsSetupSessionsUpdateBodyFromJSON deserializes JSON data into a ProviderDeploymentsSetupSessionsUpdateBody.
func MapProviderDeploymentsSetupSessionsUpdateBodyFromJSON(data []byte) (*ProviderDeploymentsSetupSessionsUpdateBody, error) {
	var v ProviderDeploymentsSetupSessionsUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsSetupSessionsUpdateBodyToJSON serializes a ProviderDeploymentsSetupSessionsUpdateBody to JSON.
func MapProviderDeploymentsSetupSessionsUpdateBodyToJSON(v *ProviderDeploymentsSetupSessionsUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
