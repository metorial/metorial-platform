package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/customproviders/environments"
)

// CustomProvidersEnvironmentsEndpoint provides access to environments represent deployment targets for custom provider versions (e.g., staging, production).
type CustomProvidersEnvironmentsEndpoint struct {
	client *endpoint.Client
}

// NewCustomProvidersEnvironmentsEndpoint creates a new CustomProvidersEnvironmentsEndpoint.
func NewCustomProvidersEnvironmentsEndpoint(client *endpoint.Client) *CustomProvidersEnvironmentsEndpoint {
	return &CustomProvidersEnvironmentsEndpoint{client: client}
}

// CustomProvidersEnvironmentsEndpointListParams contains optional query parameters for List.
type CustomProvidersEnvironmentsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by environment IDs
	Id *any `json:"id,omitempty"`
	// CustomProviderVersionId - Filter by version IDs
	CustomProviderVersionId *any `json:"custom_provider_version_id,omitempty"`
	// CustomProviderId - Filter by custom provider IDs
	CustomProviderId *any `json:"custom_provider_id,omitempty"`
}

// List returns a paginated list of environments for a custom provider.
func (e *CustomProvidersEnvironmentsEndpoint) List(params *CustomProvidersEnvironmentsEndpointListParams) (*environments.CustomProvidersEnvironmentsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"custom-provider-environments"},
		Query: query,
	}
	var result environments.CustomProvidersEnvironmentsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific environment.
func (e *CustomProvidersEnvironmentsEndpoint) Get(customProviderEnvironmentId string) (*environments.CustomProvidersEnvironmentsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"custom-provider-environments", customProviderEnvironmentId},
	}
	var result environments.CustomProvidersEnvironmentsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
