package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providerdeployments/configs"
)

// ProviderDeploymentsConfigsEndpoint provides access to a config holds settings for a deployment, like API endpoints or feature flags. Create configs with values directly, or from a saved config vault with pre-saved values.
type ProviderDeploymentsConfigsEndpoint struct {
	client *endpoint.Client
}

// NewProviderDeploymentsConfigsEndpoint creates a new ProviderDeploymentsConfigsEndpoint.
func NewProviderDeploymentsConfigsEndpoint(client *endpoint.Client) *ProviderDeploymentsConfigsEndpoint {
	return &ProviderDeploymentsConfigsEndpoint{client: client}
}

// ProviderDeploymentsConfigsEndpointListParams contains optional query parameters for List.
type ProviderDeploymentsConfigsEndpointListParams struct {
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

// ProviderDeploymentsConfigsEndpointCreateBody contains the request body for Create.
type ProviderDeploymentsConfigsEndpointCreateBody struct {
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderDeploymentId - Optional provider deployment ID
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	Name                 *string `json:"name,omitempty"`
	Description          *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Value - Provider-specific configuration values
	Value *map[string]any `json:"value,omitempty"`
	// ProviderConfigVaultId - Config vault ID to use as template
	ProviderConfigVaultId *string `json:"provider_config_vault_id,omitempty"`
}

// ProviderDeploymentsConfigsEndpointUpdateBody contains the request body for Update.
type ProviderDeploymentsConfigsEndpointUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// ProviderDeploymentsConfigsEndpointGetConfigSchemaParams contains optional query parameters for GetConfigSchema.
type ProviderDeploymentsConfigsEndpointGetConfigSchemaParams struct {
	ProviderId           *string `json:"provider_id,omitempty"`
	ProviderConfigId     *string `json:"provider_config_id,omitempty"`
	ProviderVersionId    *string `json:"provider_version_id,omitempty"`
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
}

// List returns a paginated list of provider configs.
func (e *ProviderDeploymentsConfigsEndpoint) List(instanceId string, params *ProviderDeploymentsConfigsEndpointListParams) (*configs.ProviderDeploymentsConfigsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-configs"},
		Query: query,
	}
	var result configs.ProviderDeploymentsConfigsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider config by ID.
func (e *ProviderDeploymentsConfigsEndpoint) Get(instanceId string, providerConfigId string) (*configs.ProviderDeploymentsConfigsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-configs", providerConfigId},
	}
	var result configs.ProviderDeploymentsConfigsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new provider config.
func (e *ProviderDeploymentsConfigsEndpoint) Create(instanceId string, body *ProviderDeploymentsConfigsEndpointCreateBody) (*configs.ProviderDeploymentsConfigsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-configs"},
		Body: body,
	}
	var result configs.ProviderDeploymentsConfigsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a specific provider config.
func (e *ProviderDeploymentsConfigsEndpoint) Update(instanceId string, providerConfigId string, body *ProviderDeploymentsConfigsEndpointUpdateBody) (*configs.ProviderDeploymentsConfigsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-configs", providerConfigId},
		Body: body,
	}
	var result configs.ProviderDeploymentsConfigsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete permanently deletes a provider config.
func (e *ProviderDeploymentsConfigsEndpoint) Delete(instanceId string, providerConfigId string) (*configs.ProviderDeploymentsConfigsDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-configs", providerConfigId},
	}
	var result configs.ProviderDeploymentsConfigsDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetConfigSchema retrieves the JSON Schema for configuration of this provider deployment.
func (e *ProviderDeploymentsConfigsEndpoint) GetConfigSchema(instanceId string, params *ProviderDeploymentsConfigsEndpointGetConfigSchemaParams) (*configs.ProviderDeploymentsConfigsGetConfigSchemaOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-config-schema"},
		Query: query,
	}
	var result configs.ProviderDeploymentsConfigsGetConfigSchemaOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
