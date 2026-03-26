package authcredentials

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthCredentialsCreateOutput represents the provider deployments auth credentials create output type.
type ProviderDeploymentsAuthCredentialsCreateOutput struct {
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

// MapProviderDeploymentsAuthCredentialsCreateOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthCredentialsCreateOutput.
func MapProviderDeploymentsAuthCredentialsCreateOutputFromJSON(data []byte) (*ProviderDeploymentsAuthCredentialsCreateOutput, error) {
	var v ProviderDeploymentsAuthCredentialsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthCredentialsCreateOutputToJSON serializes a ProviderDeploymentsAuthCredentialsCreateOutput to JSON.
func MapProviderDeploymentsAuthCredentialsCreateOutputToJSON(v *ProviderDeploymentsAuthCredentialsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsAuthCredentialsCreateBodyConfig represents the provider deployments auth credentials create body config type.
type ProviderDeploymentsAuthCredentialsCreateBodyConfig struct {
	Type *string `json:"type,omitempty"`
	// ClientId - OAuth client ID
	ClientId string `json:"client_id"`
	// ClientSecret - OAuth client secret
	ClientSecret string `json:"client_secret"`
	// Scopes - OAuth scopes to request
	Scopes []string `json:"scopes"`
}

// ProviderDeploymentsAuthCredentialsCreateBody represents the provider deployments auth credentials create body type.
type ProviderDeploymentsAuthCredentialsCreateBody struct {
	// ProviderId - Provider ID
	ProviderId  string  `json:"provider_id"`
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any                                    `json:"metadata,omitempty"`
	Config   ProviderDeploymentsAuthCredentialsCreateBodyConfig `json:"config"`
}

// MapProviderDeploymentsAuthCredentialsCreateBodyFromJSON deserializes JSON data into a ProviderDeploymentsAuthCredentialsCreateBody.
func MapProviderDeploymentsAuthCredentialsCreateBodyFromJSON(data []byte) (*ProviderDeploymentsAuthCredentialsCreateBody, error) {
	var v ProviderDeploymentsAuthCredentialsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthCredentialsCreateBodyToJSON serializes a ProviderDeploymentsAuthCredentialsCreateBody to JSON.
func MapProviderDeploymentsAuthCredentialsCreateBodyToJSON(v *ProviderDeploymentsAuthCredentialsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
