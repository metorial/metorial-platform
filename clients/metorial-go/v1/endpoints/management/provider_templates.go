package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providertemplates"
)

// ProviderTemplatesEndpoint provides access to provider templates are reusable, consumer-facing wrappers around provider deployments.
type ProviderTemplatesEndpoint struct {
	client *endpoint.Client
}

// NewProviderTemplatesEndpoint creates a new ProviderTemplatesEndpoint.
func NewProviderTemplatesEndpoint(client *endpoint.Client) *ProviderTemplatesEndpoint {
	return &ProviderTemplatesEndpoint{client: client}
}

// ProviderTemplatesEndpointListParams contains optional query parameters for List.
type ProviderTemplatesEndpointListParams struct {
	Limit                *float64 `json:"limit,omitempty"`
	After                *string  `json:"after,omitempty"`
	Before               *string  `json:"before,omitempty"`
	Cursor               *string  `json:"cursor,omitempty"`
	Order                *string  `json:"order,omitempty"`
	Id                   *any     `json:"id,omitempty"`
	ProviderDeploymentId *any     `json:"provider_deployment_id,omitempty"`
	Status               *any     `json:"status,omitempty"`
}

// ProviderTemplatesEndpointCreateBody contains the request body for Create.
type ProviderTemplatesEndpointCreateBody struct {
	Name                 string          `json:"name"`
	Description          *string         `json:"description,omitempty"`
	Metadata             *map[string]any `json:"metadata,omitempty"`
	ProviderDeploymentId *string         `json:"provider_deployment_id,omitempty"`
	ProviderDeployment   *map[string]any `json:"provider_deployment,omitempty"`
}

// ProviderTemplatesEndpointUpdateBody contains the request body for Update.
type ProviderTemplatesEndpointUpdateBody struct {
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
}

// List returns a paginated list of provider templates.
func (e *ProviderTemplatesEndpoint) List(instanceId string, params *ProviderTemplatesEndpointListParams) (*providertemplates.ProviderTemplatesListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-templates"},
		Query: query,
	}
	var result providertemplates.ProviderTemplatesListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider template.
func (e *ProviderTemplatesEndpoint) Get(instanceId string, providerTemplateId string) (*providertemplates.ProviderTemplatesGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-templates", providerTemplateId},
	}
	var result providertemplates.ProviderTemplatesGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new provider template from an existing provider deployment or creates a minimal backing deployment first.
func (e *ProviderTemplatesEndpoint) Create(instanceId string, body *ProviderTemplatesEndpointCreateBody) (*providertemplates.ProviderTemplatesCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-templates"},
		Body: body,
	}
	var result providertemplates.ProviderTemplatesCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates an existing provider template.
func (e *ProviderTemplatesEndpoint) Update(instanceId string, providerTemplateId string, body *ProviderTemplatesEndpointUpdateBody) (*providertemplates.ProviderTemplatesUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-templates", providerTemplateId},
		Body: body,
	}
	var result providertemplates.ProviderTemplatesUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete archives an existing provider template.
func (e *ProviderTemplatesEndpoint) Delete(instanceId string, providerTemplateId string) (*providertemplates.ProviderTemplatesDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-templates", providerTemplateId},
	}
	var result providertemplates.ProviderTemplatesDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
