package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/magicmcpgroups"
)

// MagicMcpGroupsEndpoint provides access to magic MCP groups categorize servers and can be bound to token access.
type MagicMcpGroupsEndpoint struct {
	client *endpoint.Client
}

// NewMagicMcpGroupsEndpoint creates a new MagicMcpGroupsEndpoint.
func NewMagicMcpGroupsEndpoint(client *endpoint.Client) *MagicMcpGroupsEndpoint {
	return &MagicMcpGroupsEndpoint{client: client}
}

// MagicMcpGroupsEndpointListParams contains optional query parameters for List.
type MagicMcpGroupsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	Status *any     `json:"status,omitempty"`
	Search *string  `json:"search,omitempty"`
}

// MagicMcpGroupsEndpointCreateBody contains the request body for Create.
type MagicMcpGroupsEndpointCreateBody struct {
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
}

// MagicMcpGroupsEndpointUpdateBody contains the request body for Update.
type MagicMcpGroupsEndpointUpdateBody struct {
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
}

// MagicMcpGroupsEndpointAddServersBody contains the request body for AddServers.
type MagicMcpGroupsEndpointAddServersBody struct {
	MagicMcpServerIds []string `json:"magic_mcp_server_ids"`
}

// MagicMcpGroupsEndpointRemoveServersBody contains the request body for RemoveServers.
type MagicMcpGroupsEndpointRemoveServersBody struct {
	MagicMcpServerIds []string `json:"magic_mcp_server_ids"`
}

// List returns a paginated list of magic MCP groups.
func (e *MagicMcpGroupsEndpoint) List(instanceId string, params *MagicMcpGroupsEndpointListParams) (*magicmcpgroups.MagicMcpGroupsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "magic-mcp-groups"},
		Query: query,
	}
	var result magicmcpgroups.MagicMcpGroupsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific magic MCP group.
func (e *MagicMcpGroupsEndpoint) Get(instanceId string, magicMcpGroupId string) (*magicmcpgroups.MagicMcpGroupsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "magic-mcp-groups", magicMcpGroupId},
	}
	var result magicmcpgroups.MagicMcpGroupsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a magic MCP group.
func (e *MagicMcpGroupsEndpoint) Create(instanceId string, body *MagicMcpGroupsEndpointCreateBody) (*magicmcpgroups.MagicMcpGroupsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "magic-mcp-groups"},
		Body: body,
	}
	var result magicmcpgroups.MagicMcpGroupsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete deletes a magic MCP group.
func (e *MagicMcpGroupsEndpoint) Delete(instanceId string, magicMcpGroupId string) (*magicmcpgroups.MagicMcpGroupsDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "magic-mcp-groups", magicMcpGroupId},
	}
	var result magicmcpgroups.MagicMcpGroupsDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a magic MCP group.
func (e *MagicMcpGroupsEndpoint) Update(instanceId string, magicMcpGroupId string, body *MagicMcpGroupsEndpointUpdateBody) (*magicmcpgroups.MagicMcpGroupsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "magic-mcp-groups", magicMcpGroupId},
		Body: body,
	}
	var result magicmcpgroups.MagicMcpGroupsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// AddServers adds magic MCP servers to a group.
func (e *MagicMcpGroupsEndpoint) AddServers(instanceId string, magicMcpGroupId string, body *MagicMcpGroupsEndpointAddServersBody) (*magicmcpgroups.MagicMcpGroupsAddServersOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "magic-mcp-groups", magicMcpGroupId, "add-servers"},
		Body: body,
	}
	var result magicmcpgroups.MagicMcpGroupsAddServersOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// RemoveServers removes magic MCP servers from a group.
func (e *MagicMcpGroupsEndpoint) RemoveServers(instanceId string, magicMcpGroupId string, body *MagicMcpGroupsEndpointRemoveServersBody) (*magicmcpgroups.MagicMcpGroupsRemoveServersOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "magic-mcp-groups", magicMcpGroupId, "remove-servers"},
		Body: body,
	}
	var result magicmcpgroups.MagicMcpGroupsRemoveServersOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
