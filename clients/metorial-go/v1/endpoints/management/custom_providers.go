package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/customproviders"
)

// CustomProvidersEndpoint provides access to custom providers allow you to deploy your own MCP servers. Create providers from container images, remote URLs, or serverless functions.
type CustomProvidersEndpoint struct {
	client *endpoint.Client
}

// NewCustomProvidersEndpoint creates a new CustomProvidersEndpoint.
func NewCustomProvidersEndpoint(client *endpoint.Client) *CustomProvidersEndpoint {
	return &CustomProvidersEndpoint{client: client}
}

// CustomProvidersEndpointListParams contains optional query parameters for List.
type CustomProvidersEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by status (active, archived)
	Status *any `json:"status,omitempty"`
	// Type - Filter by type (container, function, remote)
	Type *any `json:"type,omitempty"`
	// Id - Filter by custom provider IDs
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider IDs (matches providers connected to sessions)
	ProviderId *any `json:"provider_id,omitempty"`
	// Search - Search by name or description
	Search *string `json:"search,omitempty"`
}

// CustomProvidersEndpointCreateBody contains the request body for Create.
type CustomProvidersEndpointCreateBody struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	From     any             `json:"from"`
	Config   *map[string]any `json:"config,omitempty"`
}

// CustomProvidersEndpointUpdateBody contains the request body for Update.
type CustomProvidersEndpointUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Readme - README content in markdown format
	Readme *string `json:"readme,omitempty"`
}

// List returns a paginated list of custom providers.
func (e *CustomProvidersEndpoint) List(instanceId string, params *CustomProvidersEndpointListParams) (*customproviders.CustomProvidersListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "custom-providers"},
		Query: query,
	}
	var result customproviders.CustomProvidersListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific custom provider by ID.
func (e *CustomProvidersEndpoint) Get(instanceId string, customProviderId string) (*customproviders.CustomProvidersGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "custom-providers", customProviderId},
	}
	var result customproviders.CustomProvidersGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new custom provider.
func (e *CustomProvidersEndpoint) Create(instanceId string, body *CustomProvidersEndpointCreateBody) (*customproviders.CustomProvidersCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "custom-providers"},
		Body: body,
	}
	var result customproviders.CustomProvidersCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a specific custom provider.
func (e *CustomProvidersEndpoint) Update(instanceId string, customProviderId string, body *CustomProvidersEndpointUpdateBody) (*customproviders.CustomProvidersUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "custom-providers", customProviderId},
		Body: body,
	}
	var result customproviders.CustomProvidersUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
