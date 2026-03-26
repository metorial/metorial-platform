package setupsessions

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsSetupSessionsListOutputItemsAuthMethodInputSchema represents the provider deployments setup sessions list output items auth method input schema type.
type ProviderDeploymentsSetupSessionsListOutputItemsAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsSetupSessionsListOutputItemsAuthMethodOutputSchema represents the provider deployments setup sessions list output items auth method output schema type.
type ProviderDeploymentsSetupSessionsListOutputItemsAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsSetupSessionsListOutputItemsAuthMethodScopes represents the provider deployments setup sessions list output items auth method scopes type.
type ProviderDeploymentsSetupSessionsListOutputItemsAuthMethodScopes struct {
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

// ProviderDeploymentsSetupSessionsListOutputItemsAuthMethod represents the provider deployments setup sessions list output items auth method type.
type ProviderDeploymentsSetupSessionsListOutputItemsAuthMethod struct {
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
	Capabilities map[string]any                                                         `json:"capabilities"`
	InputSchema  *ProviderDeploymentsSetupSessionsListOutputItemsAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsSetupSessionsListOutputItemsAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsSetupSessionsListOutputItemsAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsListOutputItemsDeployment represents the provider deployments setup sessions list output items deployment type.
type ProviderDeploymentsSetupSessionsListOutputItemsDeployment struct {
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

// ProviderDeploymentsSetupSessionsListOutputItemsCredentials represents the provider deployments setup sessions list output items credentials type.
type ProviderDeploymentsSetupSessionsListOutputItemsCredentials struct {
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

// ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigDeploymentPreview represents the provider deployments setup sessions list output items auth config deployment preview type.
type ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigDeploymentPreview struct {
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

// ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigCredentials represents the provider deployments setup sessions list output items auth config credentials type.
type ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigCredentials struct {
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

// ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigAuthMethodInputSchema represents the provider deployments setup sessions list output items auth config auth method input schema type.
type ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigAuthMethodOutputSchema represents the provider deployments setup sessions list output items auth config auth method output schema type.
type ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigAuthMethodScopes represents the provider deployments setup sessions list output items auth config auth method scopes type.
type ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigAuthMethodScopes struct {
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

// ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigAuthMethod represents the provider deployments setup sessions list output items auth config auth method type.
type ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigAuthMethod struct {
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
	Capabilities map[string]any                                                                   `json:"capabilities"`
	InputSchema  *ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsListOutputItemsAuthConfig represents the provider deployments setup sessions list output items auth config type.
type ProviderDeploymentsSetupSessionsListOutputItemsAuthConfig struct {
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
	Metadata          *map[string]any                                                             `json:"metadata,omitempty"`
	DeploymentPreview *ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigDeploymentPreview `json:"deployment_preview,omitempty"`
	Credentials       *ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigCredentials       `json:"credentials,omitempty"`
	AuthMethod        ProviderDeploymentsSetupSessionsListOutputItemsAuthConfigAuthMethod         `json:"auth_method"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsListOutputItemsConfigDeployment represents the provider deployments setup sessions list output items config deployment type.
type ProviderDeploymentsSetupSessionsListOutputItemsConfigDeployment struct {
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

// ProviderDeploymentsSetupSessionsListOutputItemsConfigFromVaultDeployment represents the provider deployments setup sessions list output items config from vault deployment type.
type ProviderDeploymentsSetupSessionsListOutputItemsConfigFromVaultDeployment struct {
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

// ProviderDeploymentsSetupSessionsListOutputItemsConfigFromVault represents the provider deployments setup sessions list output items config from vault type.
type ProviderDeploymentsSetupSessionsListOutputItemsConfigFromVault struct {
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
	ProviderId string                                                                    `json:"provider_id"`
	Deployment *ProviderDeploymentsSetupSessionsListOutputItemsConfigFromVaultDeployment `json:"deployment,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsListOutputItemsConfig represents the provider deployments setup sessions list output items config type.
type ProviderDeploymentsSetupSessionsListOutputItemsConfig struct {
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
	SpecificationId string                                                           `json:"specification_id"`
	Deployment      *ProviderDeploymentsSetupSessionsListOutputItemsConfigDeployment `json:"deployment,omitempty"`
	FromVault       *ProviderDeploymentsSetupSessionsListOutputItemsConfigFromVault  `json:"from_vault,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsSetupSessionsListOutputItems represents the provider deployments setup sessions list output items type.
type ProviderDeploymentsSetupSessionsListOutputItems struct {
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
	ProviderId  string                                                      `json:"provider_id"`
	AuthMethod  ProviderDeploymentsSetupSessionsListOutputItemsAuthMethod   `json:"auth_method"`
	Deployment  *ProviderDeploymentsSetupSessionsListOutputItemsDeployment  `json:"deployment,omitempty"`
	Credentials *ProviderDeploymentsSetupSessionsListOutputItemsCredentials `json:"credentials,omitempty"`
	AuthConfig  *ProviderDeploymentsSetupSessionsListOutputItemsAuthConfig  `json:"auth_config,omitempty"`
	Config      *ProviderDeploymentsSetupSessionsListOutputItemsConfig      `json:"config,omitempty"`
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

// ProviderDeploymentsSetupSessionsListOutputPagination represents the provider deployments setup sessions list output pagination type.
type ProviderDeploymentsSetupSessionsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderDeploymentsSetupSessionsListOutput represents the provider deployments setup sessions list output type.
type ProviderDeploymentsSetupSessionsListOutput struct {
	Items      []ProviderDeploymentsSetupSessionsListOutputItems    `json:"items"`
	Pagination ProviderDeploymentsSetupSessionsListOutputPagination `json:"pagination"`
}

// MapProviderDeploymentsSetupSessionsListOutputFromJSON deserializes JSON data into a ProviderDeploymentsSetupSessionsListOutput.
func MapProviderDeploymentsSetupSessionsListOutputFromJSON(data []byte) (*ProviderDeploymentsSetupSessionsListOutput, error) {
	var v ProviderDeploymentsSetupSessionsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsSetupSessionsListOutputToJSON serializes a ProviderDeploymentsSetupSessionsListOutput to JSON.
func MapProviderDeploymentsSetupSessionsListOutputToJSON(v *ProviderDeploymentsSetupSessionsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsSetupSessionsListQuery represents the provider deployments setup sessions list query type.
type ProviderDeploymentsSetupSessionsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by setup session ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderAuthMethodId - Filter by auth method ID(s)
	ProviderAuthMethodId *any `json:"provider_auth_method_id,omitempty"`
	// ProviderAuthConfigId - Filter by provider auth config ID(s)
	ProviderAuthConfigId *any `json:"provider_auth_config_id,omitempty"`
	// ProviderAuthCredentialsId - Filter by provider auth credentials ID(s)
	ProviderAuthCredentialsId *any `json:"provider_auth_credentials_id,omitempty"`
	// Status - Filter by session status (archived, failed, completed, expired, pending)
	Status *any `json:"status,omitempty"`
}

// MapProviderDeploymentsSetupSessionsListQueryFromJSON deserializes JSON data into a ProviderDeploymentsSetupSessionsListQuery.
func MapProviderDeploymentsSetupSessionsListQueryFromJSON(data []byte) (*ProviderDeploymentsSetupSessionsListQuery, error) {
	var v ProviderDeploymentsSetupSessionsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsSetupSessionsListQueryToJSON serializes a ProviderDeploymentsSetupSessionsListQuery to JSON.
func MapProviderDeploymentsSetupSessionsListQueryToJSON(v *ProviderDeploymentsSetupSessionsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
