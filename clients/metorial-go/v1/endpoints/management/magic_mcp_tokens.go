package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/magicmcptokens"
)

// MagicMcpTokensEndpoint provides access to magic MCP tokens authorize access to Magic MCP servers via the /magic connection API.
type MagicMcpTokensEndpoint struct {
	client *endpoint.Client
}

// NewMagicMcpTokensEndpoint creates a new MagicMcpTokensEndpoint.
func NewMagicMcpTokensEndpoint(client *endpoint.Client) *MagicMcpTokensEndpoint {
	return &MagicMcpTokensEndpoint{client: client}
}

// MagicMcpTokensEndpointListParams contains optional query parameters for List.
type MagicMcpTokensEndpointListParams struct {
	Limit           *float64 `json:"limit,omitempty"`
	After           *string  `json:"after,omitempty"`
	Before          *string  `json:"before,omitempty"`
	Cursor          *string  `json:"cursor,omitempty"`
	Order           *string  `json:"order,omitempty"`
	Status          *any     `json:"status,omitempty"`
	MagicMcpGroupId *any     `json:"magic_mcp_group_id,omitempty"`
}

// MagicMcpTokensEndpointCreateBody contains the request body for Create.
type MagicMcpTokensEndpointCreateBody struct {
	Name        string          `json:"name"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
	GroupIds    *[]string       `json:"group_ids,omitempty"`
}

// MagicMcpTokensEndpointUpdateBody contains the request body for Update.
type MagicMcpTokensEndpointUpdateBody struct {
	Name        *string         `json:"name,omitempty"`
	Description *string         `json:"description,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
}

// MagicMcpTokensEndpointAddGroupsBody contains the request body for AddGroups.
type MagicMcpTokensEndpointAddGroupsBody struct {
	MagicMcpGroupIds []string `json:"magic_mcp_group_ids"`
}

// MagicMcpTokensEndpointRemoveGroupsBody contains the request body for RemoveGroups.
type MagicMcpTokensEndpointRemoveGroupsBody struct {
	MagicMcpGroupIds []string `json:"magic_mcp_group_ids"`
}

// List returns a paginated list of magic MCP tokens.
func (e *MagicMcpTokensEndpoint) List(instanceId string, params *MagicMcpTokensEndpointListParams) (*magicmcptokens.MagicMcpTokensListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "magic-mcp-tokens"},
		Query: query,
	}
	var result magicmcptokens.MagicMcpTokensListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific magic MCP token.
func (e *MagicMcpTokensEndpoint) Get(instanceId string, magicMcpTokenId string) (*magicmcptokens.MagicMcpTokensGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "magic-mcp-tokens", magicMcpTokenId},
	}
	var result magicmcptokens.MagicMcpTokensGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new magic MCP token.
func (e *MagicMcpTokensEndpoint) Create(instanceId string, body *MagicMcpTokensEndpointCreateBody) (*magicmcptokens.MagicMcpTokensCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "magic-mcp-tokens"},
		Body: body,
	}
	var result magicmcptokens.MagicMcpTokensCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete deletes a magic MCP token.
func (e *MagicMcpTokensEndpoint) Delete(instanceId string, magicMcpTokenId string) (*magicmcptokens.MagicMcpTokensDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "magic-mcp-tokens", magicMcpTokenId},
	}
	var result magicmcptokens.MagicMcpTokensDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a magic MCP token.
func (e *MagicMcpTokensEndpoint) Update(instanceId string, magicMcpTokenId string, body *MagicMcpTokensEndpointUpdateBody) (*magicmcptokens.MagicMcpTokensUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "magic-mcp-tokens", magicMcpTokenId},
		Body: body,
	}
	var result magicmcptokens.MagicMcpTokensUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// AddGroups adds groups to a magic MCP token.
func (e *MagicMcpTokensEndpoint) AddGroups(instanceId string, magicMcpTokenId string, body *MagicMcpTokensEndpointAddGroupsBody) (*magicmcptokens.MagicMcpTokensAddGroupsOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "magic-mcp-tokens", magicMcpTokenId, "add-groups"},
		Body: body,
	}
	var result magicmcptokens.MagicMcpTokensAddGroupsOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// RemoveGroups removes groups from a magic MCP token.
func (e *MagicMcpTokensEndpoint) RemoveGroups(instanceId string, magicMcpTokenId string, body *MagicMcpTokensEndpointRemoveGroupsBody) (*magicmcptokens.MagicMcpTokensRemoveGroupsOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "magic-mcp-tokens", magicMcpTokenId, "remove-groups"},
		Body: body,
	}
	var result magicmcptokens.MagicMcpTokensRemoveGroupsOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
