package authconfigs

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthConfigsListOutputItemsDeploymentPreview represents the provider deployments auth configs list output items deployment preview type.
type ProviderDeploymentsAuthConfigsListOutputItemsDeploymentPreview struct {
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

// ProviderDeploymentsAuthConfigsListOutputItemsCredentials represents the provider deployments auth configs list output items credentials type.
type ProviderDeploymentsAuthConfigsListOutputItemsCredentials struct {
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

// ProviderDeploymentsAuthConfigsListOutputItemsAuthMethodInputSchema represents the provider deployments auth configs list output items auth method input schema type.
type ProviderDeploymentsAuthConfigsListOutputItemsAuthMethodInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the required auth input fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsListOutputItemsAuthMethodOutputSchema represents the provider deployments auth configs list output items auth method output schema type.
type ProviderDeploymentsAuthConfigsListOutputItemsAuthMethodOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the auth output fields
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsListOutputItemsAuthMethodScopes represents the provider deployments auth configs list output items auth method scopes type.
type ProviderDeploymentsAuthConfigsListOutputItemsAuthMethodScopes struct {
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

// ProviderDeploymentsAuthConfigsListOutputItemsAuthMethod represents the provider deployments auth configs list output items auth method type.
type ProviderDeploymentsAuthConfigsListOutputItemsAuthMethod struct {
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
	Capabilities map[string]any                                                       `json:"capabilities"`
	InputSchema  *ProviderDeploymentsAuthConfigsListOutputItemsAuthMethodInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ProviderDeploymentsAuthConfigsListOutputItemsAuthMethodOutputSchema `json:"output_schema,omitempty"`
	// Scopes - Available OAuth scopes
	Scopes *[]ProviderDeploymentsAuthConfigsListOutputItemsAuthMethodScopes `json:"scopes,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderSpecificationId - Specification ID
	ProviderSpecificationId string `json:"provider_specification_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsListOutputItems represents the provider deployments auth configs list output items type.
type ProviderDeploymentsAuthConfigsListOutputItems struct {
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
	Metadata          *map[string]any                                                 `json:"metadata,omitempty"`
	DeploymentPreview *ProviderDeploymentsAuthConfigsListOutputItemsDeploymentPreview `json:"deployment_preview,omitempty"`
	Credentials       *ProviderDeploymentsAuthConfigsListOutputItemsCredentials       `json:"credentials,omitempty"`
	AuthMethod        ProviderDeploymentsAuthConfigsListOutputItemsAuthMethod         `json:"auth_method"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsAuthConfigsListOutputPagination represents the provider deployments auth configs list output pagination type.
type ProviderDeploymentsAuthConfigsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderDeploymentsAuthConfigsListOutput represents the provider deployments auth configs list output type.
type ProviderDeploymentsAuthConfigsListOutput struct {
	Items      []ProviderDeploymentsAuthConfigsListOutputItems    `json:"items"`
	Pagination ProviderDeploymentsAuthConfigsListOutputPagination `json:"pagination"`
}

// MapProviderDeploymentsAuthConfigsListOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsListOutput.
func MapProviderDeploymentsAuthConfigsListOutputFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsListOutput, error) {
	var v ProviderDeploymentsAuthConfigsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsListOutputToJSON serializes a ProviderDeploymentsAuthConfigsListOutput to JSON.
func MapProviderDeploymentsAuthConfigsListOutputToJSON(v *ProviderDeploymentsAuthConfigsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsAuthConfigsListQuery represents the provider deployments auth configs list query type.
type ProviderDeploymentsAuthConfigsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by status (active, archived)
	Status *any `json:"status,omitempty"`
	// Id - Filter by auth config ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderAuthCredentialsId - Filter by auth credentials ID(s)
	ProviderAuthCredentialsId *any `json:"provider_auth_credentials_id,omitempty"`
	// ProviderAuthMethodId - Filter by auth method ID(s)
	ProviderAuthMethodId *any `json:"provider_auth_method_id,omitempty"`
	// Search - Search by name or description
	Search *string `json:"search,omitempty"`
}

// MapProviderDeploymentsAuthConfigsListQueryFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsListQuery.
func MapProviderDeploymentsAuthConfigsListQueryFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsListQuery, error) {
	var v ProviderDeploymentsAuthConfigsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsListQueryToJSON serializes a ProviderDeploymentsAuthConfigsListQuery to JSON.
func MapProviderDeploymentsAuthConfigsListQueryToJSON(v *ProviderDeploymentsAuthConfigsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
