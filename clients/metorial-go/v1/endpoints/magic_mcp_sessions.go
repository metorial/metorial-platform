package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/magicmcpsessions"
)

// MagicMcpSessionsEndpoint provides access to magic MCP sessions map a Magic MCP server to one Subspace session and are created on demand by the MCP connection API.
type MagicMcpSessionsEndpoint struct {
	client *endpoint.Client
}

// NewMagicMcpSessionsEndpoint creates a new MagicMcpSessionsEndpoint.
func NewMagicMcpSessionsEndpoint(client *endpoint.Client) *MagicMcpSessionsEndpoint {
	return &MagicMcpSessionsEndpoint{client: client}
}

// MagicMcpSessionsEndpointListParams contains optional query parameters for List.
type MagicMcpSessionsEndpointListParams struct {
	Limit            *float64 `json:"limit,omitempty"`
	After            *string  `json:"after,omitempty"`
	Before           *string  `json:"before,omitempty"`
	Cursor           *string  `json:"cursor,omitempty"`
	Order            *string  `json:"order,omitempty"`
	MagicMcpServerId *any     `json:"magic_mcp_server_id,omitempty"`
}

// List returns a paginated list of magic MCP sessions.
func (e *MagicMcpSessionsEndpoint) List(params *MagicMcpSessionsEndpointListParams) (*magicmcpsessions.MagicMcpSessionsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"magic-mcp-sessions"},
		Query: query,
	}
	var result magicmcpsessions.MagicMcpSessionsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific magic MCP session.
func (e *MagicMcpSessionsEndpoint) Get(magicMcpSessionId string) (*magicmcpsessions.MagicMcpSessionsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"magic-mcp-sessions", magicMcpSessionId},
	}
	var result magicmcpsessions.MagicMcpSessionsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
