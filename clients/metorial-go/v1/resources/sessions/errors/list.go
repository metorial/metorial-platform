package errors

import (
	"encoding/json"
	"time"
)

// SessionsErrorsListOutputItems represents the sessions errors list output items type.
type SessionsErrorsListOutputItems struct {
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

// SessionsErrorsListOutputPagination represents the sessions errors list output pagination type.
type SessionsErrorsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// SessionsErrorsListOutput represents the sessions errors list output type.
type SessionsErrorsListOutput struct {
	Items      []SessionsErrorsListOutputItems    `json:"items"`
	Pagination SessionsErrorsListOutputPagination `json:"pagination"`
}

// MapSessionsErrorsListOutputFromJSON deserializes JSON data into a SessionsErrorsListOutput.
func MapSessionsErrorsListOutputFromJSON(data []byte) (*SessionsErrorsListOutput, error) {
	var v SessionsErrorsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsErrorsListOutputToJSON serializes a SessionsErrorsListOutput to JSON.
func MapSessionsErrorsListOutputToJSON(v *SessionsErrorsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionsErrorsListQuery represents the sessions errors list query type.
type SessionsErrorsListQuery struct {
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

// MapSessionsErrorsListQueryFromJSON deserializes JSON data into a SessionsErrorsListQuery.
func MapSessionsErrorsListQueryFromJSON(data []byte) (*SessionsErrorsListQuery, error) {
	var v SessionsErrorsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsErrorsListQueryToJSON serializes a SessionsErrorsListQuery to JSON.
func MapSessionsErrorsListQueryToJSON(v *SessionsErrorsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
