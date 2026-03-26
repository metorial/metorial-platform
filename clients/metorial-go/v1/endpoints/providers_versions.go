package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providers/versions"
)

// ProvidersVersionsEndpoint provides access to a version is a specific release of a provider (e.g., v1.2.0). Each version has its own tools, auth methods, and config schema. Deployments are pinned to a version for security reasons.
type ProvidersVersionsEndpoint struct {
	client *endpoint.Client
}

// NewProvidersVersionsEndpoint creates a new ProvidersVersionsEndpoint.
func NewProvidersVersionsEndpoint(client *endpoint.Client) *ProvidersVersionsEndpoint {
	return &ProvidersVersionsEndpoint{client: client}
}

// ProvidersVersionsEndpointListParams contains optional query parameters for List.
type ProvidersVersionsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by version ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
}

// List returns a paginated list of provider versions.
func (e *ProvidersVersionsEndpoint) List(params *ProvidersVersionsEndpointListParams) (*versions.ProvidersVersionsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"provider-versions"},
		Query: query,
	}
	var result versions.ProvidersVersionsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider version by ID.
func (e *ProvidersVersionsEndpoint) Get(providerVersionId string) (*versions.ProvidersVersionsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"provider-versions", providerVersionId},
	}
	var result versions.ProvidersVersionsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
