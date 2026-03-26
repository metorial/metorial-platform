package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/portals"
)

// PortalsEndpoint provides access to use Portals to create custom branded MCP server marketplaces for your organization.
type PortalsEndpoint struct {
	client *endpoint.Client
}

// NewPortalsEndpoint creates a new PortalsEndpoint.
func NewPortalsEndpoint(client *endpoint.Client) *PortalsEndpoint {
	return &PortalsEndpoint{client: client}
}

// PortalsEndpointListParams contains optional query parameters for List.
type PortalsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
}

// PortalsEndpointCreateBody contains the request body for Create.
type PortalsEndpointCreateBody struct {
	Name                       string   `json:"name"`
	Description                *string  `json:"description,omitempty"`
	SessionExpiryTimeInSeconds *float64 `json:"session_expiry_time_in_seconds,omitempty"`
}

// PortalsEndpointUpdateBody contains the request body for Update.
type PortalsEndpointUpdateBody struct {
	Name                       *string  `json:"name,omitempty"`
	Description                *string  `json:"description,omitempty"`
	SessionExpiryTimeInSeconds *float64 `json:"session_expiry_time_in_seconds,omitempty"`
}

// List returns a paginated list of portals.
func (e *PortalsEndpoint) List(instanceId string, params *PortalsEndpointListParams) (*portals.PortalsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "portals"},
		Query: query,
	}
	var result portals.PortalsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves details for a specific portal.
func (e *PortalsEndpoint) Get(instanceId string, portalId string) (*portals.PortalsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "portals", portalId},
	}
	var result portals.PortalsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new portal for the instance.
func (e *PortalsEndpoint) Create(instanceId string, body *PortalsEndpointCreateBody) (*portals.PortalsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "portals"},
		Body: body,
	}
	var result portals.PortalsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates an existing portal for the instance.
func (e *PortalsEndpoint) Update(instanceId string, portalId string, body *PortalsEndpointUpdateBody) (*portals.PortalsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "portals", portalId},
		Body: body,
	}
	var result portals.PortalsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete archives a portal.
func (e *PortalsEndpoint) Delete(instanceId string, portalId string) (*portals.PortalsDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "portals", portalId},
	}
	var result portals.PortalsDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
