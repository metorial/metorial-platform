package versions

import (
	"encoding/json"
	"time"
)

// ProvidersVersionsGetOutput represents the providers versions get output type.
type ProvidersVersionsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique version identifier
	Id string `json:"id"`
	// Version - Version identifier string
	Version string `json:"version"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// IsCurrent - Whether this is the current version
	IsCurrent bool `json:"is_current"`
	// Name - Version name
	Name string `json:"name"`
	// Description - Version description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId *string `json:"specification_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProvidersVersionsGetOutputFromJSON deserializes JSON data into a ProvidersVersionsGetOutput.
func MapProvidersVersionsGetOutputFromJSON(data []byte) (*ProvidersVersionsGetOutput, error) {
	var v ProvidersVersionsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProvidersVersionsGetOutputToJSON serializes a ProvidersVersionsGetOutput to JSON.
func MapProvidersVersionsGetOutputToJSON(v *ProvidersVersionsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
