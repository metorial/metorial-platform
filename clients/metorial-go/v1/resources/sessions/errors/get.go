package errors

import (
	"encoding/json"
	"time"
)

// SessionsErrorsGetOutput represents the sessions errors get output type.
type SessionsErrorsGetOutput struct {
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

// MapSessionsErrorsGetOutputFromJSON deserializes JSON data into a SessionsErrorsGetOutput.
func MapSessionsErrorsGetOutputFromJSON(data []byte) (*SessionsErrorsGetOutput, error) {
	var v SessionsErrorsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsErrorsGetOutputToJSON serializes a SessionsErrorsGetOutput to JSON.
func MapSessionsErrorsGetOutputToJSON(v *SessionsErrorsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
