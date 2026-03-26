package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/sessions/errors"
)

// SessionsErrorsEndpoint provides access to session errors track errors that occurred during a session. This read-only resource provides visibility into issues that happened during provider execution.
type SessionsErrorsEndpoint struct {
	client *endpoint.Client
}

// NewSessionsErrorsEndpoint creates a new SessionsErrorsEndpoint.
func NewSessionsErrorsEndpoint(client *endpoint.Client) *SessionsErrorsEndpoint {
	return &SessionsErrorsEndpoint{client: client}
}

// SessionsErrorsEndpointListParams contains optional query parameters for List.
type SessionsErrorsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Type - Filter by error type(s)
	Type *any `json:"type,omitempty"`
	// Id - Filter by session error ID(s)
	Id *any `json:"id,omitempty"`
	// SessionId - Filter by session ID(s)
	SessionId *any `json:"session_id,omitempty"`
	// SessionProviderId - Filter by session provider ID(s)
	SessionProviderId *any `json:"session_provider_id,omitempty"`
	// SessionConnectionId - Filter by session connection ID(s)
	SessionConnectionId *any `json:"session_connection_id,omitempty"`
	// SessionErrorGroupId - Filter by error group ID(s)
	SessionErrorGroupId *any `json:"session_error_group_id,omitempty"`
	// ProviderRunId - Filter by provider run ID(s)
	ProviderRunId *any `json:"provider_run_id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// SessionMessageId - Filter by session message ID(s)
	SessionMessageId *any `json:"session_message_id,omitempty"`
}

// List returns a paginated list of errors across all sessions.
func (e *SessionsErrorsEndpoint) List(instanceId string, params *SessionsErrorsEndpointListParams) (*errors.SessionsErrorsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "session-errors"},
		Query: query,
	}
	var result errors.SessionsErrorsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific error that occurred in a session.
func (e *SessionsErrorsEndpoint) Get(instanceId string, sessionErrorId string) (*errors.SessionsErrorsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "session-errors", sessionErrorId},
	}
	var result errors.SessionsErrorsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
