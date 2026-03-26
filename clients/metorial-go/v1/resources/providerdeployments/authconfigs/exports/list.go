package exports

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigDeploymentPreview represents the provider deployments auth configs exports list output items auth config deployment preview type.
type ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigDeploymentPreview struct {
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

// ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigCredentials represents the provider deployments auth configs exports list output items auth config credentials type.
type ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigCredentials struct {
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

// ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigAuthMethodInputSchema represents the provider deployments auth configs exports list output items auth config auth method input schema type.
type ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigAuthMethodOutputSchema represents the provider deployments auth configs exports list output items auth config auth method output schema type.
type ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigAuthMethodScopes represents the provider deployments auth configs exports list output items auth config auth method scopes type.
type ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigAuthMethodScopes struct {
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

// ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigAuthMethod represents the provider deployments auth configs exports list output items auth config auth method type.
type ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigAuthMethod struct {
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
	InputSchema  *ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfig represents the provider deployments auth configs exports list output items auth config type.
type ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfig struct {
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
	DeploymentPreview *ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigDeploymentPreview `json:"deployment_preview,omitempty"`
	Credentials       *ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigCredentials       `json:"credentials,omitempty"`
	AuthMethod        ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfigAuthMethod         `json:"auth_method"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsExportsListOutputItems represents the provider deployments auth configs exports list output items type.
type ProviderDeploymentsAuthConfigsExportsListOutputItems struct {
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
	Metadata   *map[string]any                                                `json:"metadata,omitempty"`
	AuthConfig ProviderDeploymentsAuthConfigsExportsListOutputItemsAuthConfig `json:"auth_config"`
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

// ProviderDeploymentsAuthConfigsExportsListOutputPagination represents the provider deployments auth configs exports list output pagination type.
type ProviderDeploymentsAuthConfigsExportsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderDeploymentsAuthConfigsExportsListOutput represents the provider deployments auth configs exports list output type.
type ProviderDeploymentsAuthConfigsExportsListOutput struct {
	Items      []ProviderDeploymentsAuthConfigsExportsListOutputItems    `json:"items"`
	Pagination ProviderDeploymentsAuthConfigsExportsListOutputPagination `json:"pagination"`
}

// MapProviderDeploymentsAuthConfigsExportsListOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsExportsListOutput.
func MapProviderDeploymentsAuthConfigsExportsListOutputFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsExportsListOutput, error) {
	var v ProviderDeploymentsAuthConfigsExportsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsExportsListOutputToJSON serializes a ProviderDeploymentsAuthConfigsExportsListOutput to JSON.
func MapProviderDeploymentsAuthConfigsExportsListOutputToJSON(v *ProviderDeploymentsAuthConfigsExportsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsAuthConfigsExportsListQuery represents the provider deployments auth configs exports list query type.
type ProviderDeploymentsAuthConfigsExportsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by export ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderAuthCredentialsId - Filter by auth credentials ID(s)
	ProviderAuthCredentialsId *any `json:"provider_auth_credentials_id,omitempty"`
	// ProviderAuthConfigId - Filter by auth config ID(s)
	ProviderAuthConfigId *any `json:"provider_auth_config_id,omitempty"`
}

// MapProviderDeploymentsAuthConfigsExportsListQueryFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsExportsListQuery.
func MapProviderDeploymentsAuthConfigsExportsListQueryFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsExportsListQuery, error) {
	var v ProviderDeploymentsAuthConfigsExportsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsExportsListQueryToJSON serializes a ProviderDeploymentsAuthConfigsExportsListQuery to JSON.
func MapProviderDeploymentsAuthConfigsExportsListQueryToJSON(v *ProviderDeploymentsAuthConfigsExportsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
