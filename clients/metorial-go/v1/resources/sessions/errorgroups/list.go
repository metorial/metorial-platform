package errorgroups

import (
	"encoding/json"
	"time"
)

// SessionsErrorGroupsListOutputItems represents the sessions error groups list output items type.
type SessionsErrorGroupsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session error group identifier
	Id string `json:"id"`
	// Code - Error code
	Code string `json:"code"`
	// Message - Error message
	Message string `json:"message"`
	// Data - Error group data from first occurrence
	Data map[string]any `json:"data"`
	// ProviderId - Provider ID
	ProviderId *string `json:"provider_id,omitempty"`
	// OccurrenceCount - Number of errors in this group
	OccurrenceCount float64 `json:"occurrence_count"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// SessionsErrorGroupsListOutputPagination represents the sessions error groups list output pagination type.
type SessionsErrorGroupsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// SessionsErrorGroupsListOutput represents the sessions error groups list output type.
type SessionsErrorGroupsListOutput struct {
	Items      []SessionsErrorGroupsListOutputItems    `json:"items"`
	Pagination SessionsErrorGroupsListOutputPagination `json:"pagination"`
}

// MapSessionsErrorGroupsListOutputFromJSON deserializes JSON data into a SessionsErrorGroupsListOutput.
func MapSessionsErrorGroupsListOutputFromJSON(data []byte) (*SessionsErrorGroupsListOutput, error) {
	var v SessionsErrorGroupsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsErrorGroupsListOutputToJSON serializes a SessionsErrorGroupsListOutput to JSON.
func MapSessionsErrorGroupsListOutputToJSON(v *SessionsErrorGroupsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionsErrorGroupsListQuery represents the sessions error groups list query type.
type SessionsErrorGroupsListQuery struct {
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

// MapSessionsErrorGroupsListQueryFromJSON deserializes JSON data into a SessionsErrorGroupsListQuery.
func MapSessionsErrorGroupsListQueryFromJSON(data []byte) (*SessionsErrorGroupsListQuery, error) {
	var v SessionsErrorGroupsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsErrorGroupsListQueryToJSON serializes a SessionsErrorGroupsListQuery to JSON.
func MapSessionsErrorGroupsListQueryToJSON(v *SessionsErrorGroupsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
