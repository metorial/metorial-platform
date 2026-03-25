package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providerdeployments/authconfigs"
)

// ProviderDeploymentsAuthConfigsEndpoint provides access to an auth config is a user's authenticated connection to a provider. Created when a user completes OAuth or manually enters an API token.
type ProviderDeploymentsAuthConfigsEndpoint struct {
	client *endpoint.Client
}

// NewProviderDeploymentsAuthConfigsEndpoint creates a new ProviderDeploymentsAuthConfigsEndpoint.
func NewProviderDeploymentsAuthConfigsEndpoint(client *endpoint.Client) *ProviderDeploymentsAuthConfigsEndpoint {
	return &ProviderDeploymentsAuthConfigsEndpoint{client: client}
}

// ProviderDeploymentsAuthConfigsEndpointListParams contains optional query parameters for List.
type ProviderDeploymentsAuthConfigsEndpointListParams struct {
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

// ProviderDeploymentsAuthConfigsEndpointCreateBody contains the request body for Create.
type ProviderDeploymentsAuthConfigsEndpointCreateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderAuthMethodId - The authentication method this config uses (e.g., OAuth, API key)
	ProviderAuthMethodId string `json:"provider_auth_method_id"`
	// ProviderDeploymentId - The provider deployment this auth config is associated with (if applicable)
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	// Value - Authentication config payload
	Value map[string]any `json:"value"`
}

// ProviderDeploymentsAuthConfigsEndpointUpdateBody contains the request body for Update.
type ProviderDeploymentsAuthConfigsEndpointUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// List returns a paginated list of provider auth configs.
func (e *ProviderDeploymentsAuthConfigsEndpoint) List(instanceId string, params *ProviderDeploymentsAuthConfigsEndpointListParams) (*authconfigs.ProviderDeploymentsAuthConfigsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-auth-configs"},
		Query: query,
	}
	var result authconfigs.ProviderDeploymentsAuthConfigsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider auth config by ID.
func (e *ProviderDeploymentsAuthConfigsEndpoint) Get(instanceId string, providerAuthConfigId string) (*authconfigs.ProviderDeploymentsAuthConfigsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-auth-configs", providerAuthConfigId},
	}
	var result authconfigs.ProviderDeploymentsAuthConfigsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new provider auth config.
func (e *ProviderDeploymentsAuthConfigsEndpoint) Create(instanceId string, body *ProviderDeploymentsAuthConfigsEndpointCreateBody) (*authconfigs.ProviderDeploymentsAuthConfigsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-auth-configs"},
		Body: body,
	}
	var result authconfigs.ProviderDeploymentsAuthConfigsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a specific provider auth config.
func (e *ProviderDeploymentsAuthConfigsEndpoint) Update(instanceId string, providerAuthConfigId string, body *ProviderDeploymentsAuthConfigsEndpointUpdateBody) (*authconfigs.ProviderDeploymentsAuthConfigsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-auth-configs", providerAuthConfigId},
		Body: body,
	}
	var result authconfigs.ProviderDeploymentsAuthConfigsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete permanently deletes a provider auth config.
func (e *ProviderDeploymentsAuthConfigsEndpoint) Delete(instanceId string, providerAuthConfigId string) (*authconfigs.ProviderDeploymentsAuthConfigsDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-auth-configs", providerAuthConfigId},
	}
	var result authconfigs.ProviderDeploymentsAuthConfigsDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
