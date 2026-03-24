package events

import (
	"encoding/json"
	"time"
)

// SessionsEventsListOutputItemsConnectionUsage - Usage statistics
type SessionsEventsListOutputItemsConnectionUsage struct {
	// TotalProductiveClientMessageCount - Total productive client messages
	TotalProductiveClientMessageCount float64 `json:"total_productive_client_message_count"`
	// TotalProductiveProviderMessageCount - Total productive provider messages
	TotalProductiveProviderMessageCount float64 `json:"total_productive_provider_message_count"`
}

// SessionsEventsListOutputItemsConnectionMcp - MCP connection details
type SessionsEventsListOutputItemsConnectionMcp struct {
	// Capabilities - MCP capabilities
	Capabilities map[string]any `json:"capabilities"`
	// ProtocolVersion - MCP protocol version
	ProtocolVersion string `json:"protocol_version"`
	// Transport - MCP transport type
	Transport string `json:"transport"`
}

// SessionsEventsListOutputItemsConnectionParticipant represents the sessions events list output items connection participant type.
type SessionsEventsListOutputItemsConnectionParticipant struct {
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

// SessionsEventsListOutputItemsConnection represents the sessions events list output items connection type.
type SessionsEventsListOutputItemsConnection struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session connection identifier
	Id string `json:"id"`
	// ConnectionState - Connection state
	ConnectionState string `json:"connection_state"`
	// Transport - Transport protocol used
	Transport string `json:"transport"`
	// Usage - Usage statistics
	Usage SessionsEventsListOutputItemsConnectionUsage `json:"usage"`
	// Mcp - MCP connection details
	Mcp *SessionsEventsListOutputItemsConnectionMcp `json:"mcp,omitempty"`
	// SessionId - Parent session ID
	SessionId   string                                              `json:"session_id"`
	Participant *SessionsEventsListOutputItemsConnectionParticipant `json:"participant,omitempty"`
	// HasErrors - Whether the connection has any errors
	HasErrors bool `json:"has_errors"`
	// HasWarnings - Whether the connection has any warnings
	HasWarnings bool `json:"has_warnings"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// LastMessageAt - Timestamp of last message
	LastMessageAt time.Time `json:"last_message_at"`
	// LastActiveAt - Timestamp when last active
	LastActiveAt time.Time `json:"last_active_at"`
}

// SessionsEventsListOutputItemsProviderRun represents the sessions events list output items provider run type.
type SessionsEventsListOutputItemsProviderRun struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider run identifier
	Id string `json:"id"`
	// Status - Run status
	Status string `json:"status"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// SessionProviderId - Session provider ID
	SessionProviderId string `json:"session_provider_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ConnectionId - Connection ID
	ConnectionId string `json:"connection_id"`
	// CompletedAt - Timestamp when run completed
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionsEventsListOutputItemsMessageHierarchy - Message hierarchy information
type SessionsEventsListOutputItemsMessageHierarchy struct {
	Object string `json:"object"`
	// Type - Hierarchy type
	Type string `json:"type"`
	// ParentMessageId - Parent message ID
	ParentMessageId *string `json:"parent_message_id,omitempty"`
	// ChildMessageIds - List of child message IDs
	ChildMessageIds []string `json:"child_message_ids"`
}

// SessionsEventsListOutputItemsMessageTransportMcp represents the sessions events list output items message transport mcp type.
type SessionsEventsListOutputItemsMessageTransportMcp struct {
	Object string `json:"object"`
	// Id - MCP message ID
	Id any `json:"id"`
	// ProtocolVersion - MCP protocol version
	ProtocolVersion string `json:"protocol_version"`
	// Transport - MCP transport type
	Transport string `json:"transport"`
}

// SessionsEventsListOutputItemsMessageTransportToolCall represents the sessions events list output items message transport tool call type.
type SessionsEventsListOutputItemsMessageTransportToolCall struct {
	Object string `json:"object"`
	// Id - Tool call ID
	Id string `json:"id"`
}

// SessionsEventsListOutputItemsMessageTransport - Transport information
type SessionsEventsListOutputItemsMessageTransport struct {
	Object string `json:"object"`
	// Type - Transport type
	Type     string                                                 `json:"type"`
	Mcp      *SessionsEventsListOutputItemsMessageTransportMcp      `json:"mcp,omitempty"`
	ToolCall *SessionsEventsListOutputItemsMessageTransportToolCall `json:"tool_call,omitempty"`
}

// SessionsEventsListOutputItemsMessageToolCallToolInputSchema represents the sessions events list output items message tool call tool input schema type.
type SessionsEventsListOutputItemsMessageToolCallToolInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool input parameters
	Schema map[string]any `json:"schema"`
}

// SessionsEventsListOutputItemsMessageToolCallToolOutputSchema represents the sessions events list output items message tool call tool output schema type.
type SessionsEventsListOutputItemsMessageToolCallToolOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool output format
	Schema map[string]any `json:"schema"`
}

// SessionsEventsListOutputItemsMessageToolCallToolTags represents the sessions events list output items message tool call tool tags type.
type SessionsEventsListOutputItemsMessageToolCallToolTags struct {
	// Destructive - Whether the tool is destructive
	Destructive *bool `json:"destructive,omitempty"`
	// ReadOnly - Whether the tool is read-only
	ReadOnly *bool `json:"read_only,omitempty"`
}

// SessionsEventsListOutputItemsMessageToolCallTool represents the sessions events list output items message tool call tool type.
type SessionsEventsListOutputItemsMessageToolCallTool struct {
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
	Instructions []string                                                      `json:"instructions"`
	InputSchema  *SessionsEventsListOutputItemsMessageToolCallToolInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *SessionsEventsListOutputItemsMessageToolCallToolOutputSchema `json:"output_schema,omitempty"`
	Tags         *SessionsEventsListOutputItemsMessageToolCallToolTags         `json:"tags,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId string `json:"specification_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionsEventsListOutputItemsMessageToolCallError represents the sessions events list output items message tool call error type.
type SessionsEventsListOutputItemsMessageToolCallError struct {
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

// SessionsEventsListOutputItemsMessageToolCall represents the sessions events list output items message tool call type.
type SessionsEventsListOutputItemsMessageToolCall struct {
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
	ProviderRunId *string                                            `json:"provider_run_id,omitempty"`
	Tool          SessionsEventsListOutputItemsMessageToolCallTool   `json:"tool"`
	Error         *SessionsEventsListOutputItemsMessageToolCallError `json:"error,omitempty"`
	// Input - Input data passed to the tool call
	Input *map[string]any `json:"input,omitempty"`
	// Output - Output data returned from the tool call
	Output *map[string]any `json:"output,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsEventsListOutputItemsMessageSenderParticipant represents the sessions events list output items message sender participant type.
type SessionsEventsListOutputItemsMessageSenderParticipant struct {
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

// SessionsEventsListOutputItemsMessageResponderParticipant represents the sessions events list output items message responder participant type.
type SessionsEventsListOutputItemsMessageResponderParticipant struct {
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

// SessionsEventsListOutputItemsMessageError represents the sessions events list output items message error type.
type SessionsEventsListOutputItemsMessageError struct {
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

// SessionsEventsListOutputItemsMessage represents the sessions events list output items message type.
type SessionsEventsListOutputItemsMessage struct {
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
	Hierarchy SessionsEventsListOutputItemsMessageHierarchy `json:"hierarchy"`
	// Transport - Transport information
	Transport SessionsEventsListOutputItemsMessageTransport `json:"transport"`
	// Input - Input message data
	Input *map[string]any `json:"input,omitempty"`
	// Output - Output message data
	Output               *map[string]any                                           `json:"output,omitempty"`
	ToolCall             *SessionsEventsListOutputItemsMessageToolCall             `json:"tool_call,omitempty"`
	SenderParticipant    SessionsEventsListOutputItemsMessageSenderParticipant     `json:"sender_participant"`
	ResponderParticipant *SessionsEventsListOutputItemsMessageResponderParticipant `json:"responder_participant,omitempty"`
	Error                *SessionsEventsListOutputItemsMessageError                `json:"error,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsEventsListOutputItemsError represents the sessions events list output items error type.
type SessionsEventsListOutputItemsError struct {
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

// SessionsEventsListOutputItemsWarning represents the sessions events list output items warning type.
type SessionsEventsListOutputItemsWarning struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session warning identifier
	Id string `json:"id"`
	// Code - Warning code
	Code string `json:"code"`
	// Message - Warning message
	Message string `json:"message"`
	// Data - Warning payload data
	Data map[string]any `json:"data"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// ConnectionId - Connection ID
	ConnectionId *string `json:"connection_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsEventsListOutputItems represents the sessions events list output items type.
type SessionsEventsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session event identifier
	Id string `json:"id"`
	// Type - Event type
	Type string `json:"type"`
	// SessionId - Parent session ID
	SessionId   string                                    `json:"session_id"`
	Connection  *SessionsEventsListOutputItemsConnection  `json:"connection,omitempty"`
	ProviderRun *SessionsEventsListOutputItemsProviderRun `json:"provider_run,omitempty"`
	Message     *SessionsEventsListOutputItemsMessage     `json:"message,omitempty"`
	Error       *SessionsEventsListOutputItemsError       `json:"error,omitempty"`
	Warning     *SessionsEventsListOutputItemsWarning     `json:"warning,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsEventsListOutputPagination represents the sessions events list output pagination type.
type SessionsEventsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// SessionsEventsListOutput represents the sessions events list output type.
type SessionsEventsListOutput struct {
	Items      []SessionsEventsListOutputItems    `json:"items"`
	Pagination SessionsEventsListOutputPagination `json:"pagination"`
}

// MapSessionsEventsListOutputFromJSON deserializes JSON data into a SessionsEventsListOutput.
func MapSessionsEventsListOutputFromJSON(data []byte) (*SessionsEventsListOutput, error) {
	var v SessionsEventsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsEventsListOutputToJSON serializes a SessionsEventsListOutput to JSON.
func MapSessionsEventsListOutputToJSON(v *SessionsEventsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionsEventsListQuery represents the sessions events list query type.
type SessionsEventsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Type - Filter by event type(s)
	Type *any `json:"type,omitempty"`
	// Id - Filter by session event ID(s)
	Id *any `json:"id,omitempty"`
	// SessionId - Filter by session ID(s)
	SessionId *any `json:"session_id,omitempty"`
	// SessionProviderId - Filter by session provider ID(s)
	SessionProviderId *any `json:"session_provider_id,omitempty"`
	// SessionConnectionId - Filter by session connection ID(s)
	SessionConnectionId *any `json:"session_connection_id,omitempty"`
	// ProviderRunId - Filter by provider run ID(s)
	ProviderRunId *any `json:"provider_run_id,omitempty"`
	// SessionMessageId - Filter by session message ID(s)
	SessionMessageId *any `json:"session_message_id,omitempty"`
	// SessionErrorId - Filter by session error ID(s)
	SessionErrorId *any `json:"session_error_id,omitempty"`
}

// MapSessionsEventsListQueryFromJSON deserializes JSON data into a SessionsEventsListQuery.
func MapSessionsEventsListQueryFromJSON(data []byte) (*SessionsEventsListQuery, error) {
	var v SessionsEventsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsEventsListQueryToJSON serializes a SessionsEventsListQuery to JSON.
func MapSessionsEventsListQueryToJSON(v *SessionsEventsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
