package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providerdeployments/configvaults"
)

// ProviderDeploymentsConfigVaultsEndpoint provides access to a config vault is a saved, reusable set of configuration values. Use vaults to store credentials once and apply them to multiple deployments without re-entering.
type ProviderDeploymentsConfigVaultsEndpoint struct {
	client *endpoint.Client
}

// NewProviderDeploymentsConfigVaultsEndpoint creates a new ProviderDeploymentsConfigVaultsEndpoint.
func NewProviderDeploymentsConfigVaultsEndpoint(client *endpoint.Client) *ProviderDeploymentsConfigVaultsEndpoint {
	return &ProviderDeploymentsConfigVaultsEndpoint{client: client}
}

// ProviderDeploymentsConfigVaultsEndpointListParams contains optional query parameters for List.
type ProviderDeploymentsConfigVaultsEndpointListParams struct {
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

// ProviderDeploymentsConfigVaultsEndpointCreateBody contains the request body for Create.
type ProviderDeploymentsConfigVaultsEndpointCreateBody struct {
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderDeploymentId - Provider deployment ID
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	Name                 string  `json:"name"`
	Description          *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Value - Secure configuration values to store in the vault
	Value map[string]any `json:"value"`
}

// ProviderDeploymentsConfigVaultsEndpointUpdateBody contains the request body for Update.
type ProviderDeploymentsConfigVaultsEndpointUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// List returns a paginated list of provider config vaults.
func (e *ProviderDeploymentsConfigVaultsEndpoint) List(params *ProviderDeploymentsConfigVaultsEndpointListParams) (*configvaults.ProviderDeploymentsConfigVaultsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"provider-config-vaults"},
		Query: query,
	}
	var result configvaults.ProviderDeploymentsConfigVaultsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider config vault by ID.
func (e *ProviderDeploymentsConfigVaultsEndpoint) Get(providerConfigVaultId string) (*configvaults.ProviderDeploymentsConfigVaultsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"provider-config-vaults", providerConfigVaultId},
	}
	var result configvaults.ProviderDeploymentsConfigVaultsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new provider config vault.
func (e *ProviderDeploymentsConfigVaultsEndpoint) Create(body *ProviderDeploymentsConfigVaultsEndpointCreateBody) (*configvaults.ProviderDeploymentsConfigVaultsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"provider-config-vaults"},
		Body: body,
	}
	var result configvaults.ProviderDeploymentsConfigVaultsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a specific provider config vault.
func (e *ProviderDeploymentsConfigVaultsEndpoint) Update(providerConfigVaultId string, body *ProviderDeploymentsConfigVaultsEndpointUpdateBody) (*configvaults.ProviderDeploymentsConfigVaultsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"provider-config-vaults", providerConfigVaultId},
		Body: body,
	}
	var result configvaults.ProviderDeploymentsConfigVaultsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete permanently deletes a provider config vault.
func (e *ProviderDeploymentsConfigVaultsEndpoint) Delete(providerConfigVaultId string) (*configvaults.ProviderDeploymentsConfigVaultsDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"provider-config-vaults", providerConfigVaultId},
	}
	var result configvaults.ProviderDeploymentsConfigVaultsDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
