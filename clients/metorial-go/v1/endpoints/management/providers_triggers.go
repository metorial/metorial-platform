package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providers/triggers"
)

// ProvidersTriggersEndpoint provides access to a provider trigger describes an event source a provider can emit for callbacks. Use triggers to discover which callback subscriptions a provider version supports.
type ProvidersTriggersEndpoint struct {
	client *endpoint.Client
}

// NewProvidersTriggersEndpoint creates a new ProvidersTriggersEndpoint.
func NewProvidersTriggersEndpoint(client *endpoint.Client) *ProvidersTriggersEndpoint {
	return &ProvidersTriggersEndpoint{client: client}
}

// ProvidersTriggersEndpointListParams contains optional query parameters for List.
type ProvidersTriggersEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// ProviderVersionId - Provider version to list triggers for
	ProviderVersionId string `json:"provider_version_id"`
}

// List returns a paginated list of provider triggers for a specific provider version.
func (e *ProvidersTriggersEndpoint) List(instanceId string, params *ProvidersTriggersEndpointListParams) (*triggers.ProvidersTriggersListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-triggers"},
		Query: query,
	}
	var result triggers.ProvidersTriggersListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider trigger by ID.
func (e *ProvidersTriggersEndpoint) Get(instanceId string, providerTriggerId string) (*triggers.ProvidersTriggersGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-triggers", providerTriggerId},
	}
	var result triggers.ProvidersTriggersGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
