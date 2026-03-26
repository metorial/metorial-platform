package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providerdeployments/authconfigs/exports"
)

// ProviderDeploymentsAuthConfigsExportsEndpoint provides access to an auth export lets you extract OAuth tokens or credentials from Metorial to use in other systems, avoiding duplicate authentication flows.
type ProviderDeploymentsAuthConfigsExportsEndpoint struct {
	client *endpoint.Client
}

// NewProviderDeploymentsAuthConfigsExportsEndpoint creates a new ProviderDeploymentsAuthConfigsExportsEndpoint.
func NewProviderDeploymentsAuthConfigsExportsEndpoint(client *endpoint.Client) *ProviderDeploymentsAuthConfigsExportsEndpoint {
	return &ProviderDeploymentsAuthConfigsExportsEndpoint{client: client}
}

// ProviderDeploymentsAuthConfigsExportsEndpointListParams contains optional query parameters for List.
type ProviderDeploymentsAuthConfigsExportsEndpointListParams struct {
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

// ProviderDeploymentsAuthConfigsExportsEndpointCreateBody contains the request body for Create.
type ProviderDeploymentsAuthConfigsExportsEndpointCreateBody struct {
	// ProviderAuthConfigId - Provider auth config ID
	ProviderAuthConfigId string `json:"provider_auth_config_id"`
	Note                 string `json:"note"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// List returns a paginated list of provider auth exports.
func (e *ProviderDeploymentsAuthConfigsExportsEndpoint) List(params *ProviderDeploymentsAuthConfigsExportsEndpointListParams) (*exports.ProviderDeploymentsAuthConfigsExportsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"provider-auth-config-exports"},
		Query: query,
	}
	var result exports.ProviderDeploymentsAuthConfigsExportsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider auth export by ID.
func (e *ProviderDeploymentsAuthConfigsExportsEndpoint) Get(providerAuthExportId string) (*exports.ProviderDeploymentsAuthConfigsExportsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"provider-auth-config-exports", providerAuthExportId},
	}
	var result exports.ProviderDeploymentsAuthConfigsExportsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create exports authentication credentials from a provider.
func (e *ProviderDeploymentsAuthConfigsExportsEndpoint) Create(body *ProviderDeploymentsAuthConfigsExportsEndpointCreateBody) (*exports.ProviderDeploymentsAuthConfigsExportsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"provider-auth-config-exports"},
		Body: body,
	}
	var result exports.ProviderDeploymentsAuthConfigsExportsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
