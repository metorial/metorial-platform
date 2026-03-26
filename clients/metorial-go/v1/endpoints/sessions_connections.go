package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/sessions/connections"
)

// SessionsConnectionsEndpoint provides access to session connections represent the MCP connections established within a session. This read-only resource provides visibility into the connection state and capabilities.
type SessionsConnectionsEndpoint struct {
	client *endpoint.Client
}

// NewSessionsConnectionsEndpoint creates a new SessionsConnectionsEndpoint.
func NewSessionsConnectionsEndpoint(client *endpoint.Client) *SessionsConnectionsEndpoint {
	return &SessionsConnectionsEndpoint{client: client}
}

// SessionsConnectionsEndpointListParams contains optional query parameters for List.
type SessionsConnectionsEndpointListParams struct {
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

// List returns a paginated list of connections for a session.
func (e *SessionsConnectionsEndpoint) List(params *SessionsConnectionsEndpointListParams) (*connections.SessionsConnectionsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"session-connections"},
		Query: query,
	}
	var result connections.SessionsConnectionsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific connection from a session.
func (e *SessionsConnectionsEndpoint) Get(sessionConnectionId string) (*connections.SessionsConnectionsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-connections", sessionConnectionId},
	}
	var result connections.SessionsConnectionsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
