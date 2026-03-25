package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providers/authmethods"
)

// ProvidersAuthMethodsEndpoint provides access to an auth method defines one way to authenticate with a provider (OAuth, API token, or custom credentials). A provider version may support multiple auth methods.
type ProvidersAuthMethodsEndpoint struct {
	client *endpoint.Client
}

// NewProvidersAuthMethodsEndpoint creates a new ProvidersAuthMethodsEndpoint.
func NewProvidersAuthMethodsEndpoint(client *endpoint.Client) *ProvidersAuthMethodsEndpoint {
	return &ProvidersAuthMethodsEndpoint{client: client}
}

// ProvidersAuthMethodsEndpointListParams contains optional query parameters for List.
type ProvidersAuthMethodsEndpointListParams struct {
	Limit             *float64 `json:"limit,omitempty"`
	After             *string  `json:"after,omitempty"`
	Before            *string  `json:"before,omitempty"`
	Cursor            *string  `json:"cursor,omitempty"`
	Order             *string  `json:"order,omitempty"`
	ProviderVersionId string   `json:"provider_version_id"`
}

// List returns a paginated list of provider auth methods.
func (e *ProvidersAuthMethodsEndpoint) List(instanceId string, params *ProvidersAuthMethodsEndpointListParams) (*authmethods.ProvidersAuthMethodsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-auth-methods"},
		Query: query,
	}
	var result authmethods.ProvidersAuthMethodsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider auth method by ID.
func (e *ProvidersAuthMethodsEndpoint) Get(instanceId string, providerAuthMethodId string) (*authmethods.ProvidersAuthMethodsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-auth-methods", providerAuthMethodId},
	}
	var result authmethods.ProvidersAuthMethodsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
