package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/sessions/events"
)

// SessionsEventsEndpoint provides access to session events represent significant occurrences during a session, such as errors or state changes. This read-only resource provides visibility into session activity.
type SessionsEventsEndpoint struct {
	client *endpoint.Client
}

// NewSessionsEventsEndpoint creates a new SessionsEventsEndpoint.
func NewSessionsEventsEndpoint(client *endpoint.Client) *SessionsEventsEndpoint {
	return &SessionsEventsEndpoint{client: client}
}

// SessionsEventsEndpointListParams contains optional query parameters for List.
type SessionsEventsEndpointListParams struct {
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

// List returns a paginated list of events for a session.
func (e *SessionsEventsEndpoint) List(params *SessionsEventsEndpointListParams) (*events.SessionsEventsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"session-events"},
		Query: query,
	}
	var result events.SessionsEventsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific event from a session.
func (e *SessionsEventsEndpoint) Get(sessionEventId string) (*events.SessionsEventsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-events", sessionEventId},
	}
	var result events.SessionsEventsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
