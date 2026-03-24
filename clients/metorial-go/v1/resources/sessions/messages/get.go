package messages

import (
	"encoding/json"
	"time"
)

// SessionsMessagesGetOutputHierarchy - Message hierarchy information
type SessionsMessagesGetOutputHierarchy struct {
	Object string `json:"object"`
	// Type - Hierarchy type
	Type string `json:"type"`
	// ParentMessageId - Parent message ID
	ParentMessageId *string `json:"parent_message_id,omitempty"`
	// ChildMessageIds - List of child message IDs
	ChildMessageIds []string `json:"child_message_ids"`
}

// SessionsMessagesGetOutputTransportMcp represents the sessions messages get output transport mcp type.
type SessionsMessagesGetOutputTransportMcp struct {
	Object string `json:"object"`
	// Id - MCP message ID
	Id any `json:"id"`
	// ProtocolVersion - MCP protocol version
	ProtocolVersion string `json:"protocol_version"`
	// Transport - MCP transport type
	Transport string `json:"transport"`
}

// SessionsMessagesGetOutputTransportToolCall represents the sessions messages get output transport tool call type.
type SessionsMessagesGetOutputTransportToolCall struct {
	Object string `json:"object"`
	// Id - Tool call ID
	Id string `json:"id"`
}

// SessionsMessagesGetOutputTransport - Transport information
type SessionsMessagesGetOutputTransport struct {
	Object string `json:"object"`
	// Type - Transport type
	Type     string                                      `json:"type"`
	Mcp      *SessionsMessagesGetOutputTransportMcp      `json:"mcp,omitempty"`
	ToolCall *SessionsMessagesGetOutputTransportToolCall `json:"tool_call,omitempty"`
}

// SessionsMessagesGetOutputToolCallToolInputSchema represents the sessions messages get output tool call tool input schema type.
type SessionsMessagesGetOutputToolCallToolInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool input parameters
	Schema map[string]any `json:"schema"`
}

// SessionsMessagesGetOutputToolCallToolOutputSchema represents the sessions messages get output tool call tool output schema type.
type SessionsMessagesGetOutputToolCallToolOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool output format
	Schema map[string]any `json:"schema"`
}

// SessionsMessagesGetOutputToolCallToolTags represents the sessions messages get output tool call tool tags type.
type SessionsMessagesGetOutputToolCallToolTags struct {
	// Destructive - Whether the tool is destructive
	Destructive *bool `json:"destructive,omitempty"`
	// ReadOnly - Whether the tool is read-only
	ReadOnly *bool `json:"read_only,omitempty"`
}

// SessionsMessagesGetOutputToolCallTool represents the sessions messages get output tool call tool type.
type SessionsMessagesGetOutputToolCallTool struct {
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
	Instructions []string                                           `json:"instructions"`
	InputSchema  *SessionsMessagesGetOutputToolCallToolInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *SessionsMessagesGetOutputToolCallToolOutputSchema `json:"output_schema,omitempty"`
	Tags         *SessionsMessagesGetOutputToolCallToolTags         `json:"tags,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId string `json:"specification_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionsMessagesGetOutputToolCallError represents the sessions messages get output tool call error type.
type SessionsMessagesGetOutputToolCallError struct {
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

// SessionsMessagesGetOutputToolCall represents the sessions messages get output tool call type.
type SessionsMessagesGetOutputToolCall struct {
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
	ProviderRunId *string                                 `json:"provider_run_id,omitempty"`
	Tool          SessionsMessagesGetOutputToolCallTool   `json:"tool"`
	Error         *SessionsMessagesGetOutputToolCallError `json:"error,omitempty"`
	// Input - Input data passed to the tool call
	Input *map[string]any `json:"input,omitempty"`
	// Output - Output data returned from the tool call
	Output *map[string]any `json:"output,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsMessagesGetOutputSenderParticipant represents the sessions messages get output sender participant type.
type SessionsMessagesGetOutputSenderParticipant struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session participant identifier
	Id string `json:"id"`
	// Type - Participant type
	Type string `json:"type"`
	// Identifier - Participant identifier
	Identifier string `json:"identifier"`
	// Name - Display name
	Name string `json:"name"`
	// Data - Participant payload data
	Data map[string]any `json:"data"`
	// ProviderId - Provider ID if associated
	ProviderId *string `json:"provider_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsMessagesGetOutputResponderParticipant represents the sessions messages get output responder participant type.
type SessionsMessagesGetOutputResponderParticipant struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session participant identifier
	Id string `json:"id"`
	// Type - Participant type
	Type string `json:"type"`
	// Identifier - Participant identifier
	Identifier string `json:"identifier"`
	// Name - Display name
	Name string `json:"name"`
	// Data - Participant payload data
	Data map[string]any `json:"data"`
	// ProviderId - Provider ID if associated
	ProviderId *string `json:"provider_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsMessagesGetOutputError represents the sessions messages get output error type.
type SessionsMessagesGetOutputError struct {
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

// SessionsMessagesGetOutput represents the sessions messages get output type.
type SessionsMessagesGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session message identifier
	Id string `json:"id"`
	// Type - Message type
	Type string `json:"type"`
	// Status - Message status
	Status string `json:"status"`
	// Source - Message source
	Source string `json:"source"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// SessionProviderId - Session provider ID
	SessionProviderId *string `json:"session_provider_id,omitempty"`
	// ConnectionId - Connection ID
	ConnectionId *string `json:"connection_id,omitempty"`
	// ProviderRunId - Provider run ID
	ProviderRunId *string `json:"provider_run_id,omitempty"`
	// Hierarchy - Message hierarchy information
	Hierarchy SessionsMessagesGetOutputHierarchy `json:"hierarchy"`
	// Transport - Transport information
	Transport SessionsMessagesGetOutputTransport `json:"transport"`
	// Input - Input message data
	Input *map[string]any `json:"input,omitempty"`
	// Output - Output message data
	Output               *map[string]any                                `json:"output,omitempty"`
	ToolCall             *SessionsMessagesGetOutputToolCall             `json:"tool_call,omitempty"`
	SenderParticipant    SessionsMessagesGetOutputSenderParticipant     `json:"sender_participant"`
	ResponderParticipant *SessionsMessagesGetOutputResponderParticipant `json:"responder_participant,omitempty"`
	Error                *SessionsMessagesGetOutputError                `json:"error,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// MapSessionsMessagesGetOutputFromJSON deserializes JSON data into a SessionsMessagesGetOutput.
func MapSessionsMessagesGetOutputFromJSON(data []byte) (*SessionsMessagesGetOutput, error) {
	var v SessionsMessagesGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsMessagesGetOutputToJSON serializes a SessionsMessagesGetOutput to JSON.
func MapSessionsMessagesGetOutputToJSON(v *SessionsMessagesGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
