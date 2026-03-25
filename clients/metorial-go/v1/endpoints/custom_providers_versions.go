package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/customproviders/versions"
)

// CustomProvidersVersionsEndpoint provides access to versions represent different releases of a custom provider. Each version can be deployed to environments.
type CustomProvidersVersionsEndpoint struct {
	client *endpoint.Client
}

// NewCustomProvidersVersionsEndpoint creates a new CustomProvidersVersionsEndpoint.
func NewCustomProvidersVersionsEndpoint(client *endpoint.Client) *CustomProvidersVersionsEndpoint {
	return &CustomProvidersVersionsEndpoint{client: client}
}

// CustomProvidersVersionsEndpointListParams contains optional query parameters for List.
type CustomProvidersVersionsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by deployment status
	Status *any `json:"status,omitempty"`
	// Id - Filter by version ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider IDs (matches providers connected to sessions)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderVersionId - Filter by provider version IDs (matches providers connected to sessions)
	ProviderVersionId *any `json:"provider_version_id,omitempty"`
	// CustomProviderId - Filter by custom provider IDs (matches providers connected to sessions)
	CustomProviderId *any `json:"custom_provider_id,omitempty"`
	// CustomProviderDeploymentId - Filter by custom provider deployment IDs (matches providers connected to sessions)
	CustomProviderDeploymentId *any `json:"custom_provider_deployment_id,omitempty"`
	// CustomProviderEnvironmentId - Filter by custom provider environment IDs (matches providers connected to sessions)
	CustomProviderEnvironmentId *any `json:"custom_provider_environment_id,omitempty"`
}

// CustomProvidersVersionsEndpointCreateBody contains the request body for Create.
type CustomProvidersVersionsEndpointCreateBody struct {
	// CustomProviderId - Custom provider ID
	CustomProviderId string          `json:"custom_provider_id"`
	From             any             `json:"from"`
	Config           *map[string]any `json:"config,omitempty"`
}

// List returns a paginated list of versions for a custom provider.
func (e *CustomProvidersVersionsEndpoint) List(params *CustomProvidersVersionsEndpointListParams) (*versions.CustomProvidersVersionsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"custom-provider-versions"},
		Query: query,
	}
	var result versions.CustomProvidersVersionsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific version of a custom provider.
func (e *CustomProvidersVersionsEndpoint) Get(customProviderVersionId string) (*versions.CustomProvidersVersionsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"custom-provider-versions", customProviderVersionId},
	}
	var result versions.CustomProvidersVersionsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new version for a custom provider.
func (e *CustomProvidersVersionsEndpoint) Create(body *CustomProvidersVersionsEndpointCreateBody) (*versions.CustomProvidersVersionsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"custom-provider-versions"},
		Body: body,
	}
	var result versions.CustomProvidersVersionsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
