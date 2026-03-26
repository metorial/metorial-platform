package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providers/specifications"
)

// ProvidersSpecificationsEndpoint provides access to a specification defines what a provider version can do: its tools, auth methods, and required configuration fields.
type ProvidersSpecificationsEndpoint struct {
	client *endpoint.Client
}

// NewProvidersSpecificationsEndpoint creates a new ProvidersSpecificationsEndpoint.
func NewProvidersSpecificationsEndpoint(client *endpoint.Client) *ProvidersSpecificationsEndpoint {
	return &ProvidersSpecificationsEndpoint{client: client}
}

// ProvidersSpecificationsEndpointListParams contains optional query parameters for List.
type ProvidersSpecificationsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by specification ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderVersionId - Filter by provider version ID(s)
	ProviderVersionId *any `json:"provider_version_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderConfigId - Filter by provider config ID(s)
	ProviderConfigId *any `json:"provider_config_id,omitempty"`
}

// List returns a paginated list of provider specifications.
func (e *ProvidersSpecificationsEndpoint) List(params *ProvidersSpecificationsEndpointListParams) (*specifications.ProvidersSpecificationsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"provider-specifications"},
		Query: query,
	}
	var result specifications.ProvidersSpecificationsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider specification by ID.
func (e *ProvidersSpecificationsEndpoint) Get(providerSpecificationId string) (*specifications.ProvidersSpecificationsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"provider-specifications", providerSpecificationId},
	}
	var result specifications.ProvidersSpecificationsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
