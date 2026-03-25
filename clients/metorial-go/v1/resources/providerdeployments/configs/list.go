package configs

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsConfigsListOutputItemsDeployment represents the provider deployments configs list output items deployment type.
type ProviderDeploymentsConfigsListOutputItemsDeployment struct {
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

// ProviderDeploymentsConfigsListOutputItemsFromVaultDeployment represents the provider deployments configs list output items from vault deployment type.
type ProviderDeploymentsConfigsListOutputItemsFromVaultDeployment struct {
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

// ProviderDeploymentsConfigsListOutputItemsFromVault represents the provider deployments configs list output items from vault type.
type ProviderDeploymentsConfigsListOutputItemsFromVault struct {
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
	ProviderId string                                                        `json:"provider_id"`
	Deployment *ProviderDeploymentsConfigsListOutputItemsFromVaultDeployment `json:"deployment,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsConfigsListOutputItems represents the provider deployments configs list output items type.
type ProviderDeploymentsConfigsListOutputItems struct {
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
	SpecificationId string                                               `json:"specification_id"`
	Deployment      *ProviderDeploymentsConfigsListOutputItemsDeployment `json:"deployment,omitempty"`
	FromVault       *ProviderDeploymentsConfigsListOutputItemsFromVault  `json:"from_vault,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsConfigsListOutputPagination represents the provider deployments configs list output pagination type.
type ProviderDeploymentsConfigsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderDeploymentsConfigsListOutput represents the provider deployments configs list output type.
type ProviderDeploymentsConfigsListOutput struct {
	Items      []ProviderDeploymentsConfigsListOutputItems    `json:"items"`
	Pagination ProviderDeploymentsConfigsListOutputPagination `json:"pagination"`
}

// MapProviderDeploymentsConfigsListOutputFromJSON deserializes JSON data into a ProviderDeploymentsConfigsListOutput.
func MapProviderDeploymentsConfigsListOutputFromJSON(data []byte) (*ProviderDeploymentsConfigsListOutput, error) {
	var v ProviderDeploymentsConfigsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigsListOutputToJSON serializes a ProviderDeploymentsConfigsListOutput to JSON.
func MapProviderDeploymentsConfigsListOutputToJSON(v *ProviderDeploymentsConfigsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsConfigsListQuery represents the provider deployments configs list query type.
type ProviderDeploymentsConfigsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by status (active, archived)
	Status *any `json:"status,omitempty"`
	// Id - Filter by config ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderSpecificationId - Filter by provider specification ID(s)
	ProviderSpecificationId *any `json:"provider_specification_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderConfigVaultId - Filter by config vault ID(s)
	ProviderConfigVaultId *any `json:"provider_config_vault_id,omitempty"`
	// Search - Search by name or description
	Search *string `json:"search,omitempty"`
}

// MapProviderDeploymentsConfigsListQueryFromJSON deserializes JSON data into a ProviderDeploymentsConfigsListQuery.
func MapProviderDeploymentsConfigsListQueryFromJSON(data []byte) (*ProviderDeploymentsConfigsListQuery, error) {
	var v ProviderDeploymentsConfigsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigsListQueryToJSON serializes a ProviderDeploymentsConfigsListQuery to JSON.
func MapProviderDeploymentsConfigsListQueryToJSON(v *ProviderDeploymentsConfigsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
