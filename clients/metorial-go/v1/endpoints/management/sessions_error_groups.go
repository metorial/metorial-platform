package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/sessions/errorgroups"
)

// SessionsErrorGroupsEndpoint provides access to session error groups aggregate similar errors that occurred during a session. This read-only resource helps identify patterns in errors.
type SessionsErrorGroupsEndpoint struct {
	client *endpoint.Client
}

// NewSessionsErrorGroupsEndpoint creates a new SessionsErrorGroupsEndpoint.
func NewSessionsErrorGroupsEndpoint(client *endpoint.Client) *SessionsErrorGroupsEndpoint {
	return &SessionsErrorGroupsEndpoint{client: client}
}

// SessionsErrorGroupsEndpointListParams contains optional query parameters for List.
type SessionsErrorGroupsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Type - Filter by error type(s)
	Type *any `json:"type,omitempty"`
	// Id - Filter by error group ID(s)
	Id *any `json:"id,omitempty"`
	// SessionId - Filter by session ID(s)
	SessionId *any `json:"session_id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
}

// List returns a paginated list of error groups across all sessions.
func (e *SessionsErrorGroupsEndpoint) List(instanceId string, params *SessionsErrorGroupsEndpointListParams) (*errorgroups.SessionsErrorGroupsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "session-error-groups"},
		Query: query,
	}
	var result errorgroups.SessionsErrorGroupsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific error group by ID across all sessions.
func (e *SessionsErrorGroupsEndpoint) Get(instanceId string, sessionErrorGroupId string) (*errorgroups.SessionsErrorGroupsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "session-error-groups", sessionErrorGroupId},
	}
	var result errorgroups.SessionsErrorGroupsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
