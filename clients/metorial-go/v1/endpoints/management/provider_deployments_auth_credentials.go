package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providerdeployments/authcredentials"
)

// ProviderDeploymentsAuthCredentialsEndpoint provides access to auth credentials store your OAuth app registration (client ID, client secret, and scopes). These are the app-level credentials you get from a service like GitHub or Slack.
type ProviderDeploymentsAuthCredentialsEndpoint struct {
	client *endpoint.Client
}

// NewProviderDeploymentsAuthCredentialsEndpoint creates a new ProviderDeploymentsAuthCredentialsEndpoint.
func NewProviderDeploymentsAuthCredentialsEndpoint(client *endpoint.Client) *ProviderDeploymentsAuthCredentialsEndpoint {
	return &ProviderDeploymentsAuthCredentialsEndpoint{client: client}
}

// ProviderDeploymentsAuthCredentialsEndpointListParams contains optional query parameters for List.
type ProviderDeploymentsAuthCredentialsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by status (active, archived)
	Status *any `json:"status,omitempty"`
	// Id - Filter by credential ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderAuthMethodId - Filter by provider auth method ID(s)
	ProviderAuthMethodId *any `json:"provider_auth_method_id,omitempty"`
	// Origin - Filter by credential origin (custom, managed)
	Origin *any `json:"origin,omitempty"`
	// Search - Search by name or description
	Search *string `json:"search,omitempty"`
}

// ProviderDeploymentsAuthCredentialsEndpointCreateBody contains the request body for Create.
type ProviderDeploymentsAuthCredentialsEndpointCreateBody struct {
	// ProviderId - Provider ID
	ProviderId  string  `json:"provider_id"`
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	Config   map[string]any  `json:"config"`
}

// ProviderDeploymentsAuthCredentialsEndpointUpdateBody contains the request body for Update.
type ProviderDeploymentsAuthCredentialsEndpointUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// List returns a paginated list of provider auth credentials.
func (e *ProviderDeploymentsAuthCredentialsEndpoint) List(instanceId string, params *ProviderDeploymentsAuthCredentialsEndpointListParams) (*authcredentials.ProviderDeploymentsAuthCredentialsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-auth-credentials"},
		Query: query,
	}
	var result authcredentials.ProviderDeploymentsAuthCredentialsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves specific provider auth credentials by ID.
func (e *ProviderDeploymentsAuthCredentialsEndpoint) Get(instanceId string, providerAuthCredentialsId string) (*authcredentials.ProviderDeploymentsAuthCredentialsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-auth-credentials", providerAuthCredentialsId},
	}
	var result authcredentials.ProviderDeploymentsAuthCredentialsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates new provider auth credentials.
func (e *ProviderDeploymentsAuthCredentialsEndpoint) Create(instanceId string, body *ProviderDeploymentsAuthCredentialsEndpointCreateBody) (*authcredentials.ProviderDeploymentsAuthCredentialsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-auth-credentials"},
		Body: body,
	}
	var result authcredentials.ProviderDeploymentsAuthCredentialsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates specific provider auth credentials.
func (e *ProviderDeploymentsAuthCredentialsEndpoint) Update(instanceId string, providerAuthCredentialsId string, body *ProviderDeploymentsAuthCredentialsEndpointUpdateBody) (*authcredentials.ProviderDeploymentsAuthCredentialsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-auth-credentials", providerAuthCredentialsId},
		Body: body,
	}
	var result authcredentials.ProviderDeploymentsAuthCredentialsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete permanently deletes provider auth credentials.
func (e *ProviderDeploymentsAuthCredentialsEndpoint) Delete(instanceId string, providerAuthCredentialsId string) (*authcredentials.ProviderDeploymentsAuthCredentialsDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-auth-credentials", providerAuthCredentialsId},
	}
	var result authcredentials.ProviderDeploymentsAuthCredentialsDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
