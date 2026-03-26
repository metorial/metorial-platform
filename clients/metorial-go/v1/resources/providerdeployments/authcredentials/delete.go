package authcredentials

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthCredentialsDeleteOutput represents the provider deployments auth credentials delete output type.
type ProviderDeploymentsAuthCredentialsDeleteOutput struct {
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

// MapProviderDeploymentsAuthCredentialsDeleteOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthCredentialsDeleteOutput.
func MapProviderDeploymentsAuthCredentialsDeleteOutputFromJSON(data []byte) (*ProviderDeploymentsAuthCredentialsDeleteOutput, error) {
	var v ProviderDeploymentsAuthCredentialsDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthCredentialsDeleteOutputToJSON serializes a ProviderDeploymentsAuthCredentialsDeleteOutput to JSON.
func MapProviderDeploymentsAuthCredentialsDeleteOutputToJSON(v *ProviderDeploymentsAuthCredentialsDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
