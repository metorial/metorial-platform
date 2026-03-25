package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/sessions/messages"
)

// SessionsMessagesEndpoint provides access to session messages represent the MCP protocol messages exchanged during a session. This read-only resource provides visibility into the communication between clients and providers.
type SessionsMessagesEndpoint struct {
	client *endpoint.Client
}

// NewSessionsMessagesEndpoint creates a new SessionsMessagesEndpoint.
func NewSessionsMessagesEndpoint(client *endpoint.Client) *SessionsMessagesEndpoint {
	return &SessionsMessagesEndpoint{client: client}
}

// SessionsMessagesEndpointListParams contains optional query parameters for List.
type SessionsMessagesEndpointListParams struct {
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

// List returns a paginated list of messages for a session.
func (e *SessionsMessagesEndpoint) List(instanceId string, params *SessionsMessagesEndpointListParams) (*messages.SessionsMessagesListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "session-messages"},
		Query: query,
	}
	var result messages.SessionsMessagesListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific message from a session.
func (e *SessionsMessagesEndpoint) Get(instanceId string, sessionMessageId string) (*messages.SessionsMessagesGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "session-messages", sessionMessageId},
	}
	var result messages.SessionsMessagesGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
