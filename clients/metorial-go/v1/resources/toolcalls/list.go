package toolcalls

import (
	"encoding/json"
	"time"
)

// ToolCallsListOutputItemsToolInputSchema represents the tool calls list output items tool input schema type.
type ToolCallsListOutputItemsToolInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool input parameters
	Schema map[string]any `json:"schema"`
}

// ToolCallsListOutputItemsToolOutputSchema represents the tool calls list output items tool output schema type.
type ToolCallsListOutputItemsToolOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool output format
	Schema map[string]any `json:"schema"`
}

// ToolCallsListOutputItemsToolTags represents the tool calls list output items tool tags type.
type ToolCallsListOutputItemsToolTags struct {
	// Destructive - Whether the tool is destructive
	Destructive *bool `json:"destructive,omitempty"`
	// ReadOnly - Whether the tool is read-only
	ReadOnly *bool `json:"read_only,omitempty"`
}

// ToolCallsListOutputItemsTool represents the tool calls list output items tool type.
type ToolCallsListOutputItemsTool struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique tool identifier
	Id string `json:"id"`
	// Key - Tool key
	Key string `json:"key"`
	// Name - Display name of the tool
	Name string `json:"name"`
	// Description - Tool description
	Description *string `json:"description,omitempty"`
	// Capabilities - Tool capabilities
	Capabilities map[string]any `json:"capabilities"`
	// Constraints - Tool constraints
	Constraints []string `json:"constraints"`
	// Instructions - Tool usage instructions
	Instructions []string                                  `json:"instructions"`
	InputSchema  *ToolCallsListOutputItemsToolInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ToolCallsListOutputItemsToolOutputSchema `json:"output_schema,omitempty"`
	Tags         *ToolCallsListOutputItemsToolTags         `json:"tags,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId string `json:"specification_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ToolCallsListOutputItemsError represents the tool calls list output items error type.
type ToolCallsListOutputItemsError struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session error identifier
	Id string `json:"id"`
	// Code - Error code
	Code string `json:"code"`
	// Message - Error message
	Message string `json:"message"`
	// Data - Error payload data
	Data map[string]any `json:"data"`
	// Status - Indicates whether the error is still being processed or has been fully processed and grouped.
	Status string `json:"status"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// ProviderRunId - Provider run ID
	ProviderRunId *string `json:"provider_run_id,omitempty"`
	// ConnectionId - Connection ID
	ConnectionId *string `json:"connection_id,omitempty"`
	// GroupId - Error group ID
	GroupId *string `json:"group_id,omitempty"`
	// SimilarErrorCount - Count of similar errors in the group
	SimilarErrorCount float64 `json:"similar_error_count"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// ToolCallsListOutputItems represents the tool calls list output items type.
type ToolCallsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique tool call identifier
	Id string `json:"id"`
	// ToolKey - The key identifying the tool that was called
	ToolKey string `json:"tool_key"`
	// Type - The type of the tool call
	Type string `json:"type"`
	// Status - Current status of the tool call
	Status string `json:"status"`
	// Source - Source of the tool call
	Source string `json:"source"`
	// Transport - Transport protocol used
	Transport string `json:"transport"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// MessageId - Associated session message ID
	MessageId string `json:"message_id"`
	// SessionProviderId - Session provider ID
	SessionProviderId *string `json:"session_provider_id,omitempty"`
	// ConnectionId - Session connection ID
	ConnectionId *string `json:"connection_id,omitempty"`
	// ProviderRunId - Provider run ID
	ProviderRunId *string                        `json:"provider_run_id,omitempty"`
	Tool          ToolCallsListOutputItemsTool   `json:"tool"`
	Error         *ToolCallsListOutputItemsError `json:"error,omitempty"`
	// Input - Input data passed to the tool call
	Input *map[string]any `json:"input,omitempty"`
	// Output - Output data returned from the tool call
	Output *map[string]any `json:"output,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// ToolCallsListOutputPagination represents the tool calls list output pagination type.
type ToolCallsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ToolCallsListOutput represents the tool calls list output type.
type ToolCallsListOutput struct {
	Items      []ToolCallsListOutputItems    `json:"items"`
	Pagination ToolCallsListOutputPagination `json:"pagination"`
}

// MapToolCallsListOutputFromJSON deserializes JSON data into a ToolCallsListOutput.
func MapToolCallsListOutputFromJSON(data []byte) (*ToolCallsListOutput, error) {
	var v ToolCallsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapToolCallsListOutputToJSON serializes a ToolCallsListOutput to JSON.
func MapToolCallsListOutputToJSON(v *ToolCallsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ToolCallsListQuery represents the tool calls list query type.
type ToolCallsListQuery struct {
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

// MapToolCallsListQueryFromJSON deserializes JSON data into a ToolCallsListQuery.
func MapToolCallsListQueryFromJSON(data []byte) (*ToolCallsListQuery, error) {
	var v ToolCallsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapToolCallsListQueryToJSON serializes a ToolCallsListQuery to JSON.
func MapToolCallsListQueryToJSON(v *ToolCallsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
