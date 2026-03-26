package errorgroups

import (
	"encoding/json"
	"time"
)

// SessionsErrorGroupsGetOutput represents the sessions error groups get output type.
type SessionsErrorGroupsGetOutput struct {
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

// MapSessionsErrorGroupsGetOutputFromJSON deserializes JSON data into a SessionsErrorGroupsGetOutput.
func MapSessionsErrorGroupsGetOutputFromJSON(data []byte) (*SessionsErrorGroupsGetOutput, error) {
	var v SessionsErrorGroupsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsErrorGroupsGetOutputToJSON serializes a SessionsErrorGroupsGetOutput to JSON.
func MapSessionsErrorGroupsGetOutputToJSON(v *SessionsErrorGroupsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
