package connections

import (
	"encoding/json"
	"time"
)

// SessionsConnectionsGetOutputUsage - Usage statistics
type SessionsConnectionsGetOutputUsage struct {
	// TotalProductiveClientMessageCount - Total productive client messages
	TotalProductiveClientMessageCount float64 `json:"total_productive_client_message_count"`
	// TotalProductiveProviderMessageCount - Total productive provider messages
	TotalProductiveProviderMessageCount float64 `json:"total_productive_provider_message_count"`
}

// SessionsConnectionsGetOutputMcp - MCP connection details
type SessionsConnectionsGetOutputMcp struct {
	// Capabilities - MCP capabilities
	Capabilities map[string]any `json:"capabilities"`
	// ProtocolVersion - MCP protocol version
	ProtocolVersion string `json:"protocol_version"`
	// Transport - MCP transport type
	Transport string `json:"transport"`
}

// SessionsConnectionsGetOutputParticipant represents the sessions connections get output participant type.
type SessionsConnectionsGetOutputParticipant struct {
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

// SessionsConnectionsGetOutput represents the sessions connections get output type.
type SessionsConnectionsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session connection identifier
	Id string `json:"id"`
	// ConnectionState - Connection state
	ConnectionState string `json:"connection_state"`
	// Transport - Transport protocol used
	Transport string `json:"transport"`
	// Usage - Usage statistics
	Usage SessionsConnectionsGetOutputUsage `json:"usage"`
	// Mcp - MCP connection details
	Mcp *SessionsConnectionsGetOutputMcp `json:"mcp,omitempty"`
	// SessionId - Parent session ID
	SessionId   string                                   `json:"session_id"`
	Participant *SessionsConnectionsGetOutputParticipant `json:"participant,omitempty"`
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

// MapSessionsConnectionsGetOutputFromJSON deserializes JSON data into a SessionsConnectionsGetOutput.
func MapSessionsConnectionsGetOutputFromJSON(data []byte) (*SessionsConnectionsGetOutput, error) {
	var v SessionsConnectionsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsConnectionsGetOutputToJSON serializes a SessionsConnectionsGetOutput to JSON.
func MapSessionsConnectionsGetOutputToJSON(v *SessionsConnectionsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
