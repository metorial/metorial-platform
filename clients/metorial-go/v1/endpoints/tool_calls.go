package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/toolcalls"
)

// ToolCallsEndpoint provides access to tool calls represent individual tool invocations within a session. They track the input, output, and status of each tool execution.
type ToolCallsEndpoint struct {
	client *endpoint.Client
}

// NewToolCallsEndpoint creates a new ToolCallsEndpoint.
func NewToolCallsEndpoint(client *endpoint.Client) *ToolCallsEndpoint {
	return &ToolCallsEndpoint{client: client}
}

// ToolCallsEndpointListParams contains optional query parameters for List.
type ToolCallsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// SessionTemplateId - Filter by session template ID(s)
	SessionTemplateId *any `json:"session_template_id,omitempty"`
	// SessionProviderId - Filter by session provider ID(s)
	SessionProviderId *any `json:"session_provider_id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderConfigId - Filter by provider config ID(s)
	ProviderConfigId *any `json:"provider_config_id,omitempty"`
	// ProviderAuthConfigId - Filter by provider auth config ID(s)
	ProviderAuthConfigId *any `json:"provider_auth_config_id,omitempty"`
	// ToolId - Filter by tool ID(s)
	ToolId *any `json:"tool_id,omitempty"`
}

// ToolCallsEndpointCreateBody contains the request body for Create.
type ToolCallsEndpointCreateBody struct {
	// ToolId - The ID of the tool to call
	ToolId string `json:"tool_id"`
	// Input - Input data to pass to the tool
	Input map[string]any `json:"input"`
	// Metadata - Optional metadata for the tool call
	Metadata *map[string]any `json:"metadata,omitempty"`
	// SessionId - The ID of the session to which this tool call belongs
	SessionId string `json:"session_id"`
}

// List returns a paginated list of tool calls across all sessions.
func (e *ToolCallsEndpoint) List(params *ToolCallsEndpointListParams) (*toolcalls.ToolCallsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"tool-calls"},
		Query: query,
	}
	var result toolcalls.ToolCallsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific tool call by ID.
func (e *ToolCallsEndpoint) Get(toolCallId string) (*toolcalls.ToolCallsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"tool-calls", toolCallId},
	}
	var result toolcalls.ToolCallsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new tool call in a session by invoking a specific tool.
func (e *ToolCallsEndpoint) Create(body *ToolCallsEndpointCreateBody) (*toolcalls.ToolCallsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"tool-calls"},
		Body: body,
	}
	var result toolcalls.ToolCallsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
