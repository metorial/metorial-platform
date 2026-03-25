package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providerdeployments"
)

// ProviderDeploymentsEndpoint provides access to a deployment is a running instance of a provider, pinned to a specific version. Deployments support custom configuration values and user authentication.
type ProviderDeploymentsEndpoint struct {
	client *endpoint.Client
}

// NewProviderDeploymentsEndpoint creates a new ProviderDeploymentsEndpoint.
func NewProviderDeploymentsEndpoint(client *endpoint.Client) *ProviderDeploymentsEndpoint {
	return &ProviderDeploymentsEndpoint{client: client}
}

// ProviderDeploymentsEndpointListParams contains optional query parameters for List.
type ProviderDeploymentsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by deployment ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderVersionId - Filter by version ID(s)
	ProviderVersionId *any `json:"provider_version_id,omitempty"`
	// Status - Filter by status (active, archived)
	Status *any `json:"status,omitempty"`
	// Search - Search by name or description
	Search *string `json:"search,omitempty"`
}

// ProviderDeploymentsEndpointCreateBody contains the request body for Create.
type ProviderDeploymentsEndpointCreateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderId - The provider to deploy
	ProviderId string `json:"provider_id"`
	// LockedProviderVersionId - Pin this deployment to a specific provider version
	LockedProviderVersionId *string `json:"locked_provider_version_id,omitempty"`
	// ProviderConfigId - Existing provider config ID
	ProviderConfigId *string `json:"provider_config_id,omitempty"`
	ProviderConfig   *any    `json:"provider_config,omitempty"`
}

// ProviderDeploymentsEndpointUpdateBody contains the request body for Update.
type ProviderDeploymentsEndpointUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// List returns a paginated list of provider deployments.
func (e *ProviderDeploymentsEndpoint) List(instanceId string, params *ProviderDeploymentsEndpointListParams) (*providerdeployments.ProviderDeploymentsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-deployments"},
		Query: query,
	}
	var result providerdeployments.ProviderDeploymentsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider deployment by ID.
func (e *ProviderDeploymentsEndpoint) Get(instanceId string, providerDeploymentId string) (*providerdeployments.ProviderDeploymentsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-deployments", providerDeploymentId},
	}
	var result providerdeployments.ProviderDeploymentsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new provider deployment.
func (e *ProviderDeploymentsEndpoint) Create(instanceId string, body *ProviderDeploymentsEndpointCreateBody) (*providerdeployments.ProviderDeploymentsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-deployments"},
		Body: body,
	}
	var result providerdeployments.ProviderDeploymentsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a specific provider deployment.
func (e *ProviderDeploymentsEndpoint) Update(instanceId string, providerDeploymentId string, body *ProviderDeploymentsEndpointUpdateBody) (*providerdeployments.ProviderDeploymentsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-deployments", providerDeploymentId},
		Body: body,
	}
	var result providerdeployments.ProviderDeploymentsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete permanently deletes a provider deployment.
func (e *ProviderDeploymentsEndpoint) Delete(instanceId string, providerDeploymentId string) (*providerdeployments.ProviderDeploymentsDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-deployments", providerDeploymentId},
	}
	var result providerdeployments.ProviderDeploymentsDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
