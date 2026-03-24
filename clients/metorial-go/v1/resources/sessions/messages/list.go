package messages

import (
	"encoding/json"
	"time"
)

// SessionsMessagesListOutputItemsHierarchy - Message hierarchy information
type SessionsMessagesListOutputItemsHierarchy struct {
	Object string `json:"object"`
	// Type - Hierarchy type
	Type string `json:"type"`
	// ParentMessageId - Parent message ID
	ParentMessageId *string `json:"parent_message_id,omitempty"`
	// ChildMessageIds - List of child message IDs
	ChildMessageIds []string `json:"child_message_ids"`
}

// SessionsMessagesListOutputItemsTransportMcp represents the sessions messages list output items transport mcp type.
type SessionsMessagesListOutputItemsTransportMcp struct {
	Object string `json:"object"`
	// Id - MCP message ID
	Id any `json:"id"`
	// ProtocolVersion - MCP protocol version
	ProtocolVersion string `json:"protocol_version"`
	// Transport - MCP transport type
	Transport string `json:"transport"`
}

// SessionsMessagesListOutputItemsTransportToolCall represents the sessions messages list output items transport tool call type.
type SessionsMessagesListOutputItemsTransportToolCall struct {
	Object string `json:"object"`
	// Id - Tool call ID
	Id string `json:"id"`
}

// SessionsMessagesListOutputItemsTransport - Transport information
type SessionsMessagesListOutputItemsTransport struct {
	Object string `json:"object"`
	// Type - Transport type
	Type     string                                            `json:"type"`
	Mcp      *SessionsMessagesListOutputItemsTransportMcp      `json:"mcp,omitempty"`
	ToolCall *SessionsMessagesListOutputItemsTransportToolCall `json:"tool_call,omitempty"`
}

// SessionsMessagesListOutputItemsToolCallToolInputSchema represents the sessions messages list output items tool call tool input schema type.
type SessionsMessagesListOutputItemsToolCallToolInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool input parameters
	Schema map[string]any `json:"schema"`
}

// SessionsMessagesListOutputItemsToolCallToolOutputSchema represents the sessions messages list output items tool call tool output schema type.
type SessionsMessagesListOutputItemsToolCallToolOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool output format
	Schema map[string]any `json:"schema"`
}

// SessionsMessagesListOutputItemsToolCallToolTags represents the sessions messages list output items tool call tool tags type.
type SessionsMessagesListOutputItemsToolCallToolTags struct {
	// Destructive - Whether the tool is destructive
	Destructive *bool `json:"destructive,omitempty"`
	// ReadOnly - Whether the tool is read-only
	ReadOnly *bool `json:"read_only,omitempty"`
}

// SessionsMessagesListOutputItemsToolCallTool represents the sessions messages list output items tool call tool type.
type SessionsMessagesListOutputItemsToolCallTool struct {
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
	Instructions []string                                                 `json:"instructions"`
	InputSchema  *SessionsMessagesListOutputItemsToolCallToolInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *SessionsMessagesListOutputItemsToolCallToolOutputSchema `json:"output_schema,omitempty"`
	Tags         *SessionsMessagesListOutputItemsToolCallToolTags         `json:"tags,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId string `json:"specification_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionsMessagesListOutputItemsToolCallError represents the sessions messages list output items tool call error type.
type SessionsMessagesListOutputItemsToolCallError struct {
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

// SessionsMessagesListOutputItemsToolCall represents the sessions messages list output items tool call type.
type SessionsMessagesListOutputItemsToolCall struct {
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
	ProviderRunId *string                                       `json:"provider_run_id,omitempty"`
	Tool          SessionsMessagesListOutputItemsToolCallTool   `json:"tool"`
	Error         *SessionsMessagesListOutputItemsToolCallError `json:"error,omitempty"`
	// Input - Input data passed to the tool call
	Input *map[string]any `json:"input,omitempty"`
	// Output - Output data returned from the tool call
	Output *map[string]any `json:"output,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsMessagesListOutputItemsSenderParticipant represents the sessions messages list output items sender participant type.
type SessionsMessagesListOutputItemsSenderParticipant struct {
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

// SessionsMessagesListOutputItemsResponderParticipant represents the sessions messages list output items responder participant type.
type SessionsMessagesListOutputItemsResponderParticipant struct {
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

// SessionsMessagesListOutputItemsError represents the sessions messages list output items error type.
type SessionsMessagesListOutputItemsError struct {
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

// SessionsMessagesListOutputItems represents the sessions messages list output items type.
type SessionsMessagesListOutputItems struct {
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
	Hierarchy SessionsMessagesListOutputItemsHierarchy `json:"hierarchy"`
	// Transport - Transport information
	Transport SessionsMessagesListOutputItemsTransport `json:"transport"`
	// Input - Input message data
	Input *map[string]any `json:"input,omitempty"`
	// Output - Output message data
	Output               *map[string]any                                      `json:"output,omitempty"`
	ToolCall             *SessionsMessagesListOutputItemsToolCall             `json:"tool_call,omitempty"`
	SenderParticipant    SessionsMessagesListOutputItemsSenderParticipant     `json:"sender_participant"`
	ResponderParticipant *SessionsMessagesListOutputItemsResponderParticipant `json:"responder_participant,omitempty"`
	Error                *SessionsMessagesListOutputItemsError                `json:"error,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsMessagesListOutputPagination represents the sessions messages list output pagination type.
type SessionsMessagesListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// SessionsMessagesListOutput represents the sessions messages list output type.
type SessionsMessagesListOutput struct {
	Items      []SessionsMessagesListOutputItems    `json:"items"`
	Pagination SessionsMessagesListOutputPagination `json:"pagination"`
}

// MapSessionsMessagesListOutputFromJSON deserializes JSON data into a SessionsMessagesListOutput.
func MapSessionsMessagesListOutputFromJSON(data []byte) (*SessionsMessagesListOutput, error) {
	var v SessionsMessagesListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsMessagesListOutputToJSON serializes a SessionsMessagesListOutput to JSON.
func MapSessionsMessagesListOutputToJSON(v *SessionsMessagesListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionsMessagesListQuery represents the sessions messages list query type.
type SessionsMessagesListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Type - Filter by message type(s)
	Type *any `json:"type,omitempty"`
	// Source - Filter by message source(s)
	Source *any `json:"source,omitempty"`
	// Hierarchy - Filter by message hierarchy
	Hierarchy *any `json:"hierarchy,omitempty"`
	// Id - Filter by message ID(s)
	Id *any `json:"id,omitempty"`
	// SessionId - Filter by session ID(s)
	SessionId *any `json:"session_id,omitempty"`
	// SessionProviderId - Filter by session provider ID(s)
	SessionProviderId *any `json:"session_provider_id,omitempty"`
	// SessionConnectionId - Filter by session connection ID(s)
	SessionConnectionId *any `json:"session_connection_id,omitempty"`
	// ProviderRunId - Filter by provider run ID(s)
	ProviderRunId *any `json:"provider_run_id,omitempty"`
	// ErrorId - Filter by error ID(s)
	ErrorId *any `json:"error_id,omitempty"`
	// ParticipantId - Filter by participant ID(s)
	ParticipantId *any `json:"participant_id,omitempty"`
	// ParentMessageId - Filter by parent message ID(s)
	ParentMessageId *any `json:"parent_message_id,omitempty"`
}

// MapSessionsMessagesListQueryFromJSON deserializes JSON data into a SessionsMessagesListQuery.
func MapSessionsMessagesListQueryFromJSON(data []byte) (*SessionsMessagesListQuery, error) {
	var v SessionsMessagesListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsMessagesListQueryToJSON serializes a SessionsMessagesListQuery to JSON.
func MapSessionsMessagesListQueryToJSON(v *SessionsMessagesListQuery) ([]byte, error) {
	return json.Marshal(v)
}
