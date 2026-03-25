package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/sessions/participants"
)

// SessionsParticipantsEndpoint provides access to session participants represent the clients and other entities that are connected to a session. This read-only resource tracks who is participating in a session.
type SessionsParticipantsEndpoint struct {
	client *endpoint.Client
}

// NewSessionsParticipantsEndpoint creates a new SessionsParticipantsEndpoint.
func NewSessionsParticipantsEndpoint(client *endpoint.Client) *SessionsParticipantsEndpoint {
	return &SessionsParticipantsEndpoint{client: client}
}

// SessionsParticipantsEndpointListParams contains optional query parameters for List.
type SessionsParticipantsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Type - Filter by participant type(s)
	Type *any `json:"type,omitempty"`
	// Id - Filter by participant ID(s)
	Id *any `json:"id,omitempty"`
	// SessionId - Filter by session ID(s)
	SessionId *any `json:"session_id,omitempty"`
	// SessionConnectionId - Filter by session connection ID(s)
	SessionConnectionId *any `json:"session_connection_id,omitempty"`
	// SessionMessageId - Filter by session message ID(s)
	SessionMessageId *any `json:"session_message_id,omitempty"`
}

// List returns a paginated list of participants in a session.
func (e *SessionsParticipantsEndpoint) List(instanceId string, params *SessionsParticipantsEndpointListParams) (*participants.SessionsParticipantsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "session-participants"},
		Query: query,
	}
	var result participants.SessionsParticipantsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific participant in a session.
func (e *SessionsParticipantsEndpoint) Get(instanceId string, sessionParticipantId string) (*participants.SessionsParticipantsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "session-participants", sessionParticipantId},
	}
	var result participants.SessionsParticipantsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
