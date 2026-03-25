package authcredentials

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthCredentialsUpdateOutput represents the provider deployments auth credentials update output type.
type ProviderDeploymentsAuthCredentialsUpdateOutput struct {
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

// MapProviderDeploymentsAuthCredentialsUpdateOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthCredentialsUpdateOutput.
func MapProviderDeploymentsAuthCredentialsUpdateOutputFromJSON(data []byte) (*ProviderDeploymentsAuthCredentialsUpdateOutput, error) {
	var v ProviderDeploymentsAuthCredentialsUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthCredentialsUpdateOutputToJSON serializes a ProviderDeploymentsAuthCredentialsUpdateOutput to JSON.
func MapProviderDeploymentsAuthCredentialsUpdateOutputToJSON(v *ProviderDeploymentsAuthCredentialsUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsAuthCredentialsUpdateBody represents the provider deployments auth credentials update body type.
type ProviderDeploymentsAuthCredentialsUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// MapProviderDeploymentsAuthCredentialsUpdateBodyFromJSON deserializes JSON data into a ProviderDeploymentsAuthCredentialsUpdateBody.
func MapProviderDeploymentsAuthCredentialsUpdateBodyFromJSON(data []byte) (*ProviderDeploymentsAuthCredentialsUpdateBody, error) {
	var v ProviderDeploymentsAuthCredentialsUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthCredentialsUpdateBodyToJSON serializes a ProviderDeploymentsAuthCredentialsUpdateBody to JSON.
func MapProviderDeploymentsAuthCredentialsUpdateBodyToJSON(v *ProviderDeploymentsAuthCredentialsUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
