package connections

import (
	"encoding/json"
	"time"
)

// SessionsConnectionsListOutputItemsUsage - Usage statistics
type SessionsConnectionsListOutputItemsUsage struct {
	// TotalProductiveClientMessageCount - Total productive client messages
	TotalProductiveClientMessageCount float64 `json:"total_productive_client_message_count"`
	// TotalProductiveProviderMessageCount - Total productive provider messages
	TotalProductiveProviderMessageCount float64 `json:"total_productive_provider_message_count"`
}

// SessionsConnectionsListOutputItemsMcp - MCP connection details
type SessionsConnectionsListOutputItemsMcp struct {
	// Capabilities - MCP capabilities
	Capabilities map[string]any `json:"capabilities"`
	// ProtocolVersion - MCP protocol version
	ProtocolVersion string `json:"protocol_version"`
	// Transport - MCP transport type
	Transport string `json:"transport"`
}

// SessionsConnectionsListOutputItemsParticipant represents the sessions connections list output items participant type.
type SessionsConnectionsListOutputItemsParticipant struct {
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

// SessionsConnectionsListOutputItems represents the sessions connections list output items type.
type SessionsConnectionsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session connection identifier
	Id string `json:"id"`
	// ConnectionState - Connection state
	ConnectionState string `json:"connection_state"`
	// Transport - Transport protocol used
	Transport string `json:"transport"`
	// Usage - Usage statistics
	Usage SessionsConnectionsListOutputItemsUsage `json:"usage"`
	// Mcp - MCP connection details
	Mcp *SessionsConnectionsListOutputItemsMcp `json:"mcp,omitempty"`
	// SessionId - Parent session ID
	SessionId   string                                         `json:"session_id"`
	Participant *SessionsConnectionsListOutputItemsParticipant `json:"participant,omitempty"`
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

// SessionsConnectionsListOutputPagination represents the sessions connections list output pagination type.
type SessionsConnectionsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// SessionsConnectionsListOutput represents the sessions connections list output type.
type SessionsConnectionsListOutput struct {
	Items      []SessionsConnectionsListOutputItems    `json:"items"`
	Pagination SessionsConnectionsListOutputPagination `json:"pagination"`
}

// MapSessionsConnectionsListOutputFromJSON deserializes JSON data into a SessionsConnectionsListOutput.
func MapSessionsConnectionsListOutputFromJSON(data []byte) (*SessionsConnectionsListOutput, error) {
	var v SessionsConnectionsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsConnectionsListOutputToJSON serializes a SessionsConnectionsListOutput to JSON.
func MapSessionsConnectionsListOutputToJSON(v *SessionsConnectionsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionsConnectionsListQuery represents the sessions connections list query type.
type SessionsConnectionsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by connection status
	Status *any `json:"status,omitempty"`
	// ConnectionState - Filter by connection state
	ConnectionState *any `json:"connection_state,omitempty"`
	// Id - Filter by session connection ID(s)
	Id *any `json:"id,omitempty"`
	// SessionId - Filter by session ID(s)
	SessionId *any `json:"session_id,omitempty"`
	// SessionProviderId - Filter by session provider ID(s)
	SessionProviderId *any `json:"session_provider_id,omitempty"`
	// ParticipantId - Filter by participant ID(s)
	ParticipantId *any `json:"participant_id,omitempty"`
}

// MapSessionsConnectionsListQueryFromJSON deserializes JSON data into a SessionsConnectionsListQuery.
func MapSessionsConnectionsListQueryFromJSON(data []byte) (*SessionsConnectionsListQuery, error) {
	var v SessionsConnectionsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsConnectionsListQueryToJSON serializes a SessionsConnectionsListQuery to JSON.
func MapSessionsConnectionsListQueryToJSON(v *SessionsConnectionsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
