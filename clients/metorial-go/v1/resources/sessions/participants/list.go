package participants

import (
	"encoding/json"
	"time"
)

// SessionsParticipantsListOutputItems represents the sessions participants list output items type.
type SessionsParticipantsListOutputItems struct {
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

// SessionsParticipantsListOutputPagination represents the sessions participants list output pagination type.
type SessionsParticipantsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// SessionsParticipantsListOutput represents the sessions participants list output type.
type SessionsParticipantsListOutput struct {
	Items      []SessionsParticipantsListOutputItems    `json:"items"`
	Pagination SessionsParticipantsListOutputPagination `json:"pagination"`
}

// MapSessionsParticipantsListOutputFromJSON deserializes JSON data into a SessionsParticipantsListOutput.
func MapSessionsParticipantsListOutputFromJSON(data []byte) (*SessionsParticipantsListOutput, error) {
	var v SessionsParticipantsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsParticipantsListOutputToJSON serializes a SessionsParticipantsListOutput to JSON.
func MapSessionsParticipantsListOutputToJSON(v *SessionsParticipantsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionsParticipantsListQuery represents the sessions participants list query type.
type SessionsParticipantsListQuery struct {
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

// MapSessionsParticipantsListQueryFromJSON deserializes JSON data into a SessionsParticipantsListQuery.
func MapSessionsParticipantsListQueryFromJSON(data []byte) (*SessionsParticipantsListQuery, error) {
	var v SessionsParticipantsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsParticipantsListQueryToJSON serializes a SessionsParticipantsListQuery to JSON.
func MapSessionsParticipantsListQueryToJSON(v *SessionsParticipantsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
