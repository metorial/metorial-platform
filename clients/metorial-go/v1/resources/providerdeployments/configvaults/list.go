package configvaults

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsConfigVaultsListOutputItemsDeployment represents the provider deployments config vaults list output items deployment type.
type ProviderDeploymentsConfigVaultsListOutputItemsDeployment struct {
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

// ProviderDeploymentsConfigVaultsListOutputItems represents the provider deployments config vaults list output items type.
type ProviderDeploymentsConfigVaultsListOutputItems struct {
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
	ProviderId string                                                    `json:"provider_id"`
	Deployment *ProviderDeploymentsConfigVaultsListOutputItemsDeployment `json:"deployment,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsConfigVaultsListOutputPagination represents the provider deployments config vaults list output pagination type.
type ProviderDeploymentsConfigVaultsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderDeploymentsConfigVaultsListOutput represents the provider deployments config vaults list output type.
type ProviderDeploymentsConfigVaultsListOutput struct {
	Items      []ProviderDeploymentsConfigVaultsListOutputItems    `json:"items"`
	Pagination ProviderDeploymentsConfigVaultsListOutputPagination `json:"pagination"`
}

// MapProviderDeploymentsConfigVaultsListOutputFromJSON deserializes JSON data into a ProviderDeploymentsConfigVaultsListOutput.
func MapProviderDeploymentsConfigVaultsListOutputFromJSON(data []byte) (*ProviderDeploymentsConfigVaultsListOutput, error) {
	var v ProviderDeploymentsConfigVaultsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigVaultsListOutputToJSON serializes a ProviderDeploymentsConfigVaultsListOutput to JSON.
func MapProviderDeploymentsConfigVaultsListOutputToJSON(v *ProviderDeploymentsConfigVaultsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsConfigVaultsListQuery represents the provider deployments config vaults list query type.
type ProviderDeploymentsConfigVaultsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by status (active, archived)
	Status *any `json:"status,omitempty"`
	// Id - Filter by config vault ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderConfigId - Filter by provider config ID(s)
	ProviderConfigId *any `json:"provider_config_id,omitempty"`
	// ProviderConfigVaultId - Filter by config vault ID(s)
	ProviderConfigVaultId *any `json:"provider_config_vault_id,omitempty"`
	// Search - Search by name or description
	Search *string `json:"search,omitempty"`
}

// MapProviderDeploymentsConfigVaultsListQueryFromJSON deserializes JSON data into a ProviderDeploymentsConfigVaultsListQuery.
func MapProviderDeploymentsConfigVaultsListQueryFromJSON(data []byte) (*ProviderDeploymentsConfigVaultsListQuery, error) {
	var v ProviderDeploymentsConfigVaultsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigVaultsListQueryToJSON serializes a ProviderDeploymentsConfigVaultsListQuery to JSON.
func MapProviderDeploymentsConfigVaultsListQueryToJSON(v *ProviderDeploymentsConfigVaultsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
