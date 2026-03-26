package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providers/tools"
)

// ProvidersToolsEndpoint provides access to a tool is a single action a provider can perform like 'search_issues' or 'send_message'. Tools are what AI agents call via MCP. By default, tools from the latest provider version are returned. Use the optional version filter to get tools for a specific version.
type ProvidersToolsEndpoint struct {
	client *endpoint.Client
}

// NewProvidersToolsEndpoint creates a new ProvidersToolsEndpoint.
func NewProvidersToolsEndpoint(client *endpoint.Client) *ProvidersToolsEndpoint {
	return &ProvidersToolsEndpoint{client: client}
}

// ProvidersToolsEndpointListParams contains optional query parameters for List.
type ProvidersToolsEndpointListParams struct {
	Limit             *float64 `json:"limit,omitempty"`
	After             *string  `json:"after,omitempty"`
	Before            *string  `json:"before,omitempty"`
	Cursor            *string  `json:"cursor,omitempty"`
	Order             *string  `json:"order,omitempty"`
	ProviderVersionId string   `json:"provider_version_id"`
}

// List returns a paginated list of provider tools. By default returns tools from the latest version. Use optional filters to get tools for a specific version.
func (e *ProvidersToolsEndpoint) List(params *ProvidersToolsEndpointListParams) (*tools.ProvidersToolsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"providers-tools"},
		Query: query,
	}
	var result tools.ProvidersToolsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider tool by ID.
func (e *ProvidersToolsEndpoint) Get(providerToolId string) (*tools.ProvidersToolsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"providers-tools", providerToolId},
	}
	var result tools.ProvidersToolsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
