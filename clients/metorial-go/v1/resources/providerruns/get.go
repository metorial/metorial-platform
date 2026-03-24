package providerruns

import (
	"encoding/json"
	"time"
)

// ProviderRunsGetOutput represents the provider runs get output type.
type ProviderRunsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider run identifier
	Id string `json:"id"`
	// Status - Run status
	Status string `json:"status"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// SessionProviderId - Session provider ID
	SessionProviderId string `json:"session_provider_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ConnectionId - Connection ID
	ConnectionId string `json:"connection_id"`
	// CompletedAt - Timestamp when run completed
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderRunsGetOutputFromJSON deserializes JSON data into a ProviderRunsGetOutput.
func MapProviderRunsGetOutputFromJSON(data []byte) (*ProviderRunsGetOutput, error) {
	var v ProviderRunsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderRunsGetOutputToJSON serializes a ProviderRunsGetOutput to JSON.
func MapProviderRunsGetOutputToJSON(v *ProviderRunsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
