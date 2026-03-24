package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providers"
)

// ProvidersEndpoint provides access to a provider is a read-only template for an MCP server integration (like GitHub or Slack). To use a provider, create a deployment from it.
type ProvidersEndpoint struct {
	client *endpoint.Client
}

// NewProvidersEndpoint creates a new ProvidersEndpoint.
func NewProvidersEndpoint(client *endpoint.Client) *ProvidersEndpoint {
	return &ProvidersEndpoint{client: client}
}

// ProvidersEndpointListParams contains optional query parameters for List.
type ProvidersEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by provider ID(s)
	Id *any `json:"id,omitempty"`
}

// List returns a paginated list of providers.
func (e *ProvidersEndpoint) List(params *ProvidersEndpointListParams) (*providers.ProvidersListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"providers"},
		Query: query,
	}
	var result providers.ProvidersListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider by ID.
func (e *ProvidersEndpoint) Get(providerId string) (*providers.ProvidersGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"providers", providerId},
	}
	var result providers.ProvidersGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
