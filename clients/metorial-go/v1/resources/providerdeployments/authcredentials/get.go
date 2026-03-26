package authcredentials

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthCredentialsGetOutput represents the provider deployments auth credentials get output type.
type ProviderDeploymentsAuthCredentialsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique credentials identifier
	Id   string `json:"id"`
	Type string `json:"type"`
	// IsDefault - Whether this is the default credentials for the provider
	IsDefault bool `json:"is_default"`
	// IsManaged - Whether these credentials are managed by Metorial
	IsManaged bool `json:"is_managed"`
	// Name - Display name
	Name *string `json:"name,omitempty"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsAuthCredentialsGetOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthCredentialsGetOutput.
func MapProviderDeploymentsAuthCredentialsGetOutputFromJSON(data []byte) (*ProviderDeploymentsAuthCredentialsGetOutput, error) {
	var v ProviderDeploymentsAuthCredentialsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthCredentialsGetOutputToJSON serializes a ProviderDeploymentsAuthCredentialsGetOutput to JSON.
func MapProviderDeploymentsAuthCredentialsGetOutputToJSON(v *ProviderDeploymentsAuthCredentialsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
