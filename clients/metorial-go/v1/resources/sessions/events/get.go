package events

import (
	"encoding/json"
	"time"
)

// SessionsEventsGetOutputConnectionUsage - Usage statistics
type SessionsEventsGetOutputConnectionUsage struct {
	// TotalProductiveClientMessageCount - Total productive client messages
	TotalProductiveClientMessageCount float64 `json:"total_productive_client_message_count"`
	// TotalProductiveProviderMessageCount - Total productive provider messages
	TotalProductiveProviderMessageCount float64 `json:"total_productive_provider_message_count"`
}

// SessionsEventsGetOutputConnectionMcp - MCP connection details
type SessionsEventsGetOutputConnectionMcp struct {
	// Capabilities - MCP capabilities
	Capabilities map[string]any `json:"capabilities"`
	// ProtocolVersion - MCP protocol version
	ProtocolVersion string `json:"protocol_version"`
	// Transport - MCP transport type
	Transport string `json:"transport"`
}

// SessionsEventsGetOutputConnectionParticipantData - Participant payload data
type SessionsEventsGetOutputConnectionParticipantData struct {
	// Identifier - Participant-specific identifier within the payload
	Identifier string `json:"identifier"`
	// Name - Participant-specific display name within the payload
	Name string `json:"name"`
}

// SessionsEventsGetOutputConnectionParticipant represents the sessions events get output connection participant type.
type SessionsEventsGetOutputConnectionParticipant struct {
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
	Data SessionsEventsGetOutputConnectionParticipantData `json:"data"`
	// ProviderId - Provider ID if associated
	ProviderId *string `json:"provider_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsEventsGetOutputConnection represents the sessions events get output connection type.
type SessionsEventsGetOutputConnection struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session connection identifier
	Id string `json:"id"`
	// ConnectionState - Connection state
	ConnectionState string `json:"connection_state"`
	// Transport - Transport protocol used
	Transport string `json:"transport"`
	// Usage - Usage statistics
	Usage SessionsEventsGetOutputConnectionUsage `json:"usage"`
	// Mcp - MCP connection details
	Mcp *SessionsEventsGetOutputConnectionMcp `json:"mcp,omitempty"`
	// SessionId - Parent session ID
	SessionId   string                                        `json:"session_id"`
	Participant *SessionsEventsGetOutputConnectionParticipant `json:"participant,omitempty"`
	// HasErrors - Whether the connection has any errors
	HasErrors bool `json:"has_errors"`
	// HasWarnings - Whether the connection has any warnings
	HasWarnings bool `json:"has_warnings"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// LastMessageAt - Timestamp of last message
	LastMessageAt time.Time `json:"last_message_at"`
	// LastActiveAt - Timestamp when last active
	LastActiveAt *time.Time `json:"last_active_at,omitempty"`
}

// SessionsEventsGetOutputProviderRun represents the sessions events get output provider run type.
type SessionsEventsGetOutputProviderRun struct {
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

// SessionsEventsGetOutputMessageHierarchy - Message hierarchy information
type SessionsEventsGetOutputMessageHierarchy struct {
	Object string `json:"object"`
	// Type - Hierarchy type
	Type string `json:"type"`
	// ParentMessageId - Parent message ID
	ParentMessageId *string `json:"parent_message_id,omitempty"`
	// ChildMessageIds - List of child message IDs
	ChildMessageIds []string `json:"child_message_ids"`
}

// SessionsEventsGetOutputMessageTransportMcp represents the sessions events get output message transport mcp type.
type SessionsEventsGetOutputMessageTransportMcp struct {
	Object string `json:"object"`
	// Id - MCP message ID
	Id any `json:"id"`
	// ProtocolVersion - MCP protocol version
	ProtocolVersion string `json:"protocol_version"`
	// Transport - MCP transport type
	Transport string `json:"transport"`
}

// SessionsEventsGetOutputMessageTransportToolCall represents the sessions events get output message transport tool call type.
type SessionsEventsGetOutputMessageTransportToolCall struct {
	Object string `json:"object"`
	// Id - Tool call ID
	Id string `json:"id"`
}

// SessionsEventsGetOutputMessageTransport - Transport information
type SessionsEventsGetOutputMessageTransport struct {
	Object string `json:"object"`
	// Type - Transport type
	Type     string                                           `json:"type"`
	Mcp      *SessionsEventsGetOutputMessageTransportMcp      `json:"mcp,omitempty"`
	ToolCall *SessionsEventsGetOutputMessageTransportToolCall `json:"tool_call,omitempty"`
}

// SessionsEventsGetOutputMessageToolCallToolInputSchema represents the sessions events get output message tool call tool input schema type.
type SessionsEventsGetOutputMessageToolCallToolInputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool input parameters
	Schema map[string]any `json:"schema"`
}

// SessionsEventsGetOutputMessageToolCallToolOutputSchema represents the sessions events get output message tool call tool output schema type.
type SessionsEventsGetOutputMessageToolCallToolOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the tool output format
	Schema map[string]any `json:"schema"`
}

// SessionsEventsGetOutputMessageToolCallToolTags represents the sessions events get output message tool call tool tags type.
type SessionsEventsGetOutputMessageToolCallToolTags struct {
	// Destructive - Whether the tool is destructive
	Destructive *bool `json:"destructive,omitempty"`
	// ReadOnly - Whether the tool is read-only
	ReadOnly *bool `json:"read_only,omitempty"`
}

// SessionsEventsGetOutputMessageToolCallTool represents the sessions events get output message tool call tool type.
type SessionsEventsGetOutputMessageToolCallTool struct {
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
	Instructions []string                                                `json:"instructions"`
	InputSchema  *SessionsEventsGetOutputMessageToolCallToolInputSchema  `json:"input_schema,omitempty"`
	OutputSchema *SessionsEventsGetOutputMessageToolCallToolOutputSchema `json:"output_schema,omitempty"`
	Tags         *SessionsEventsGetOutputMessageToolCallToolTags         `json:"tags,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId string `json:"specification_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionsEventsGetOutputMessageToolCallError represents the sessions events get output message tool call error type.
type SessionsEventsGetOutputMessageToolCallError struct {
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

// SessionsEventsGetOutputMessageToolCall represents the sessions events get output message tool call type.
type SessionsEventsGetOutputMessageToolCall struct {
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
	ProviderRunId *string                                      `json:"provider_run_id,omitempty"`
	Tool          SessionsEventsGetOutputMessageToolCallTool   `json:"tool"`
	Error         *SessionsEventsGetOutputMessageToolCallError `json:"error,omitempty"`
	// Input - Input data passed to the tool call
	Input *map[string]any `json:"input,omitempty"`
	// Output - Output data returned from the tool call
	Output *map[string]any `json:"output,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsEventsGetOutputMessageSenderParticipantData - Participant payload data
type SessionsEventsGetOutputMessageSenderParticipantData struct {
	// Identifier - Participant-specific identifier within the payload
	Identifier string `json:"identifier"`
	// Name - Participant-specific display name within the payload
	Name string `json:"name"`
}

// SessionsEventsGetOutputMessageSenderParticipant represents the sessions events get output message sender participant type.
type SessionsEventsGetOutputMessageSenderParticipant struct {
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
	Data SessionsEventsGetOutputMessageSenderParticipantData `json:"data"`
	// ProviderId - Provider ID if associated
	ProviderId *string `json:"provider_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsEventsGetOutputMessageResponderParticipantData - Participant payload data
type SessionsEventsGetOutputMessageResponderParticipantData struct {
	// Identifier - Participant-specific identifier within the payload
	Identifier string `json:"identifier"`
	// Name - Participant-specific display name within the payload
	Name string `json:"name"`
}

// SessionsEventsGetOutputMessageResponderParticipant represents the sessions events get output message responder participant type.
type SessionsEventsGetOutputMessageResponderParticipant struct {
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
	Data SessionsEventsGetOutputMessageResponderParticipantData `json:"data"`
	// ProviderId - Provider ID if associated
	ProviderId *string `json:"provider_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsEventsGetOutputMessageError represents the sessions events get output message error type.
type SessionsEventsGetOutputMessageError struct {
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

// SessionsEventsGetOutputMessage represents the sessions events get output message type.
type SessionsEventsGetOutputMessage struct {
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
	Hierarchy SessionsEventsGetOutputMessageHierarchy `json:"hierarchy"`
	// Transport - Transport information
	Transport SessionsEventsGetOutputMessageTransport `json:"transport"`
	// Input - Input message data
	Input *map[string]any `json:"input,omitempty"`
	// Output - Output message data
	Output               *map[string]any                                     `json:"output,omitempty"`
	ToolCall             *SessionsEventsGetOutputMessageToolCall             `json:"tool_call,omitempty"`
	SenderParticipant    SessionsEventsGetOutputMessageSenderParticipant     `json:"sender_participant"`
	ResponderParticipant *SessionsEventsGetOutputMessageResponderParticipant `json:"responder_participant,omitempty"`
	Error                *SessionsEventsGetOutputMessageError                `json:"error,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsEventsGetOutputError represents the sessions events get output error type.
type SessionsEventsGetOutputError struct {
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

// SessionsEventsGetOutputWarning represents the sessions events get output warning type.
type SessionsEventsGetOutputWarning struct {
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

// SessionsEventsGetOutput represents the sessions events get output type.
type SessionsEventsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session event identifier
	Id string `json:"id"`
	// Type - Event type
	Type string `json:"type"`
	// SessionId - Parent session ID
	SessionId   string                              `json:"session_id"`
	Connection  *SessionsEventsGetOutputConnection  `json:"connection,omitempty"`
	ProviderRun *SessionsEventsGetOutputProviderRun `json:"provider_run,omitempty"`
	Message     *SessionsEventsGetOutputMessage     `json:"message,omitempty"`
	Error       *SessionsEventsGetOutputError       `json:"error,omitempty"`
	Warning     *SessionsEventsGetOutputWarning     `json:"warning,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// MapSessionsEventsGetOutputFromJSON deserializes JSON data into a SessionsEventsGetOutput.
func MapSessionsEventsGetOutputFromJSON(data []byte) (*SessionsEventsGetOutput, error) {
	var v SessionsEventsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsEventsGetOutputToJSON serializes a SessionsEventsGetOutput to JSON.
func MapSessionsEventsGetOutputToJSON(v *SessionsEventsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
