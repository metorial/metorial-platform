package toolcalls

import (
	"encoding/json"
	"time"
)

// ToolCallsGetOutputToolInputSchema represents the tool calls get output tool input schema type.
type ToolCallsGetOutputToolInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool input parameters
	Schema map[string]any `json:"schema"`
}

// ToolCallsGetOutputToolOutputSchema represents the tool calls get output tool output schema type.
type ToolCallsGetOutputToolOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool output format
	Schema map[string]any `json:"schema"`
}

// ToolCallsGetOutputToolTags represents the tool calls get output tool tags type.
type ToolCallsGetOutputToolTags struct {
	// Destructive - Whether the tool is destructive
	Destructive *bool `json:"destructive,omitempty"`
	// ReadOnly - Whether the tool is read-only
	ReadOnly *bool `json:"read_only,omitempty"`
}

// ToolCallsGetOutputTool represents the tool calls get output tool type.
type ToolCallsGetOutputTool struct {
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
	Instructions []string                            `json:"instructions"`
	InputSchema  *ToolCallsGetOutputToolInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *ToolCallsGetOutputToolOutputSchema `json:"output_schema,omitempty"`
	Tags         *ToolCallsGetOutputToolTags         `json:"tags,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId string `json:"specification_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ToolCallsGetOutputError represents the tool calls get output error type.
type ToolCallsGetOutputError struct {
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

// ToolCallsGetOutput represents the tool calls get output type.
type ToolCallsGetOutput struct {
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
	ProviderRunId *string                  `json:"provider_run_id,omitempty"`
	Tool          ToolCallsGetOutputTool   `json:"tool"`
	Error         *ToolCallsGetOutputError `json:"error,omitempty"`
	// Input - Input data passed to the tool call
	Input *map[string]any `json:"input,omitempty"`
	// Output - Output data returned from the tool call
	Output *map[string]any `json:"output,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// MapToolCallsGetOutputFromJSON deserializes JSON data into a ToolCallsGetOutput.
func MapToolCallsGetOutputFromJSON(data []byte) (*ToolCallsGetOutput, error) {
	var v ToolCallsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapToolCallsGetOutputToJSON serializes a ToolCallsGetOutput to JSON.
func MapToolCallsGetOutputToJSON(v *ToolCallsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
