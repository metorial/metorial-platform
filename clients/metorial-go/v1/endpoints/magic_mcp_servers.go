package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/magicmcpservers"
)

// MagicMcpServersEndpoint provides access to magic MCP servers are stable MCP entrypoints backed by one Subspace session template.
type MagicMcpServersEndpoint struct {
	client *endpoint.Client
}

// NewMagicMcpServersEndpoint creates a new MagicMcpServersEndpoint.
func NewMagicMcpServersEndpoint(client *endpoint.Client) *MagicMcpServersEndpoint {
	return &MagicMcpServersEndpoint{client: client}
}

// MagicMcpServersEndpointListParams contains optional query parameters for List.
type MagicMcpServersEndpointListParams struct {
	Limit           *float64 `json:"limit,omitempty"`
	After           *string  `json:"after,omitempty"`
	Before          *string  `json:"before,omitempty"`
	Cursor          *string  `json:"cursor,omitempty"`
	Order           *string  `json:"order,omitempty"`
	Status          *any     `json:"status,omitempty"`
	MagicMcpGroupId *any     `json:"magic_mcp_group_id,omitempty"`
	Search          *string  `json:"search,omitempty"`
}

// MagicMcpServersEndpointCreateBody contains the request body for Create.
type MagicMcpServersEndpointCreateBody struct {
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
}

// MagicMcpServersEndpointUpdateBody contains the request body for Update.
type MagicMcpServersEndpointUpdateBody struct {
	Name              *string         `json:"name,omitempty"`
	Description       *string         `json:"description,omitempty"`
	Metadata          *map[string]any `json:"metadata,omitempty"`
	Aliases           *[]string       `json:"aliases,omitempty"`
	SessionTemplateId *string         `json:"session_template_id,omitempty"`
}

// List returns a paginated list of magic MCP servers.
func (e *MagicMcpServersEndpoint) List(params *MagicMcpServersEndpointListParams) (*magicmcpservers.MagicMcpServersListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"magic-mcp-servers"},
		Query: query,
	}
	var result magicmcpservers.MagicMcpServersListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific magic MCP server.
func (e *MagicMcpServersEndpoint) Get(magicMcpServerId string) (*magicmcpservers.MagicMcpServersGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"magic-mcp-servers", magicMcpServerId},
	}
	var result magicmcpservers.MagicMcpServersGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a magic MCP server with a new session template. A Subspace session is created automatically on first connection and then reused.
func (e *MagicMcpServersEndpoint) Create(body *MagicMcpServersEndpointCreateBody) (*magicmcpservers.MagicMcpServersCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"magic-mcp-servers"},
		Body: body,
	}
	var result magicmcpservers.MagicMcpServersCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete archives a magic MCP server.
func (e *MagicMcpServersEndpoint) Delete(magicMcpServerId string) (*magicmcpservers.MagicMcpServersDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"magic-mcp-servers", magicMcpServerId},
	}
	var result magicmcpservers.MagicMcpServersDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a magic MCP server.
func (e *MagicMcpServersEndpoint) Update(magicMcpServerId string, body *MagicMcpServersEndpointUpdateBody) (*magicmcpservers.MagicMcpServersUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"magic-mcp-servers", magicMcpServerId},
		Body: body,
	}
	var result magicmcpservers.MagicMcpServersUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
