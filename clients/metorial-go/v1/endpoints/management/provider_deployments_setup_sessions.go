package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providerdeployments/setupsessions"
)

// ProviderDeploymentsSetupSessionsEndpoint provides access to a setup session tracks an in-progress OAuth flow, storing state during the redirect. On success, it creates an auth config with the user's access token.
type ProviderDeploymentsSetupSessionsEndpoint struct {
	client *endpoint.Client
}

// NewProviderDeploymentsSetupSessionsEndpoint creates a new ProviderDeploymentsSetupSessionsEndpoint.
func NewProviderDeploymentsSetupSessionsEndpoint(client *endpoint.Client) *ProviderDeploymentsSetupSessionsEndpoint {
	return &ProviderDeploymentsSetupSessionsEndpoint{client: client}
}

// ProviderDeploymentsSetupSessionsEndpointListParams contains optional query parameters for List.
type ProviderDeploymentsSetupSessionsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by setup session ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderAuthMethodId - Filter by auth method ID(s)
	ProviderAuthMethodId *any `json:"provider_auth_method_id,omitempty"`
	// ProviderAuthConfigId - Filter by provider auth config ID(s)
	ProviderAuthConfigId *any `json:"provider_auth_config_id,omitempty"`
	// ProviderAuthCredentialsId - Filter by provider auth credentials ID(s)
	ProviderAuthCredentialsId *any `json:"provider_auth_credentials_id,omitempty"`
	// Status - Filter by session status (archived, failed, completed, expired, pending)
	Status *any `json:"status,omitempty"`
}

// ProviderDeploymentsSetupSessionsEndpointCreateBody contains the request body for Create.
type ProviderDeploymentsSetupSessionsEndpointCreateBody struct {
	// ProviderId - The provider ID
	ProviderId string `json:"provider_id"`
	// ProviderDeploymentId - Optional provider deployment ID
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	Name                 *string `json:"name,omitempty"`
	Description          *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderAuthMethodId - The authentication method to use (e.g., OAuth flow)
	ProviderAuthMethodId *string `json:"provider_auth_method_id,omitempty"`
	// ProviderAuthCredentialsId - Optional OAuth app credentials to use instead of defaults
	ProviderAuthCredentialsId *string `json:"provider_auth_credentials_id,omitempty"`
	RedirectUrl               *string `json:"redirect_url,omitempty"`
}

// ProviderDeploymentsSetupSessionsEndpointUpdateBody contains the request body for Update.
type ProviderDeploymentsSetupSessionsEndpointUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// List returns a paginated list of provider setup sessions.
func (e *ProviderDeploymentsSetupSessionsEndpoint) List(instanceId string, params *ProviderDeploymentsSetupSessionsEndpointListParams) (*setupsessions.ProviderDeploymentsSetupSessionsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-setup-sessions"},
		Query: query,
	}
	var result setupsessions.ProviderDeploymentsSetupSessionsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider setup session by ID.
func (e *ProviderDeploymentsSetupSessionsEndpoint) Get(instanceId string, providerSetupSessionId string) (*setupsessions.ProviderDeploymentsSetupSessionsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-setup-sessions", providerSetupSessionId},
	}
	var result setupsessions.ProviderDeploymentsSetupSessionsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new provider setup session for OAuth authentication.
func (e *ProviderDeploymentsSetupSessionsEndpoint) Create(instanceId string, body *ProviderDeploymentsSetupSessionsEndpointCreateBody) (*setupsessions.ProviderDeploymentsSetupSessionsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-setup-sessions"},
		Body: body,
	}
	var result setupsessions.ProviderDeploymentsSetupSessionsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a specific provider setup session.
func (e *ProviderDeploymentsSetupSessionsEndpoint) Update(instanceId string, providerSetupSessionId string, body *ProviderDeploymentsSetupSessionsEndpointUpdateBody) (*setupsessions.ProviderDeploymentsSetupSessionsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-setup-sessions", providerSetupSessionId},
		Body: body,
	}
	var result setupsessions.ProviderDeploymentsSetupSessionsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete deletes a provider setup session.
func (e *ProviderDeploymentsSetupSessionsEndpoint) Delete(instanceId string, providerSetupSessionId string) (*setupsessions.ProviderDeploymentsSetupSessionsDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-setup-sessions", providerSetupSessionId},
	}
	var result setupsessions.ProviderDeploymentsSetupSessionsDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
