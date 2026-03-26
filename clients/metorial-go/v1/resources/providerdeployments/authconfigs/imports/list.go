package imports

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigDeploymentPreview represents the provider deployments auth configs imports list output items auth config deployment preview type.
type ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigDeploymentPreview struct {
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

// ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigCredentials represents the provider deployments auth configs imports list output items auth config credentials type.
type ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigCredentials struct {
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

// ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigAuthMethodInputSchema represents the provider deployments auth configs imports list output items auth config auth method input schema type.
type ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigAuthMethodOutputSchema represents the provider deployments auth configs imports list output items auth config auth method output schema type.
type ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigAuthMethodScopes represents the provider deployments auth configs imports list output items auth config auth method scopes type.
type ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigAuthMethodScopes struct {
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

// ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigAuthMethod represents the provider deployments auth configs imports list output items auth config auth method type.
type ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigAuthMethod struct {
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
	Capabilities map[string]any                                                                        `json:"capabilities"`
	InputSchema  *ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfig represents the provider deployments auth configs imports list output items auth config type.
type ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfig struct {
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
	Metadata          *map[string]any                                                                  `json:"metadata,omitempty"`
	DeploymentPreview *ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigDeploymentPreview `json:"deployment_preview,omitempty"`
	Credentials       *ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigCredentials       `json:"credentials,omitempty"`
	AuthMethod        ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfigAuthMethod         `json:"auth_method"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsImportsListOutputItems represents the provider deployments auth configs imports list output items type.
type ProviderDeploymentsAuthConfigsImportsListOutputItems struct {
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
	Metadata   *map[string]any                                                `json:"metadata,omitempty"`
	AuthConfig ProviderDeploymentsAuthConfigsImportsListOutputItemsAuthConfig `json:"auth_config"`
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

// ProviderDeploymentsAuthConfigsImportsListOutputPagination represents the provider deployments auth configs imports list output pagination type.
type ProviderDeploymentsAuthConfigsImportsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderDeploymentsAuthConfigsImportsListOutput represents the provider deployments auth configs imports list output type.
type ProviderDeploymentsAuthConfigsImportsListOutput struct {
	Items      []ProviderDeploymentsAuthConfigsImportsListOutputItems    `json:"items"`
	Pagination ProviderDeploymentsAuthConfigsImportsListOutputPagination `json:"pagination"`
}

// MapProviderDeploymentsAuthConfigsImportsListOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsImportsListOutput.
func MapProviderDeploymentsAuthConfigsImportsListOutputFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsImportsListOutput, error) {
	var v ProviderDeploymentsAuthConfigsImportsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsImportsListOutputToJSON serializes a ProviderDeploymentsAuthConfigsImportsListOutput to JSON.
func MapProviderDeploymentsAuthConfigsImportsListOutputToJSON(v *ProviderDeploymentsAuthConfigsImportsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsAuthConfigsImportsListQuery represents the provider deployments auth configs imports list query type.
type ProviderDeploymentsAuthConfigsImportsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by import ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderAuthCredentialsId - Filter by auth credentials ID(s)
	ProviderAuthCredentialsId *any `json:"provider_auth_credentials_id,omitempty"`
	// ProviderAuthConfigId - Filter by auth config ID(s)
	ProviderAuthConfigId *any `json:"provider_auth_config_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
}

// MapProviderDeploymentsAuthConfigsImportsListQueryFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsImportsListQuery.
func MapProviderDeploymentsAuthConfigsImportsListQueryFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsImportsListQuery, error) {
	var v ProviderDeploymentsAuthConfigsImportsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsImportsListQueryToJSON serializes a ProviderDeploymentsAuthConfigsImportsListQuery to JSON.
func MapProviderDeploymentsAuthConfigsImportsListQueryToJSON(v *ProviderDeploymentsAuthConfigsImportsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
