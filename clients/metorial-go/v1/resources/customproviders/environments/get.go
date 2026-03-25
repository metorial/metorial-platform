package environments

import (
	"encoding/json"
	"time"
)

// CustomProvidersEnvironmentsGetOutput represents the custom providers environments get output type.
type CustomProvidersEnvironmentsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider environment identifier
	Id string `json:"id"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId *string `json:"provider_id,omitempty"`
	// CurrentProviderVersionId - ID of the current provider version in this environment
	CurrentProviderVersionId *string `json:"current_provider_version_id,omitempty"`
	// InstanceId - ID of the instance this environment is associated with
	InstanceId string `json:"instance_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCustomProvidersEnvironmentsGetOutputFromJSON deserializes JSON data into a CustomProvidersEnvironmentsGetOutput.
func MapCustomProvidersEnvironmentsGetOutputFromJSON(data []byte) (*CustomProvidersEnvironmentsGetOutput, error) {
	var v CustomProvidersEnvironmentsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersEnvironmentsGetOutputToJSON serializes a CustomProvidersEnvironmentsGetOutput to JSON.
func MapCustomProvidersEnvironmentsGetOutputToJSON(v *CustomProvidersEnvironmentsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
