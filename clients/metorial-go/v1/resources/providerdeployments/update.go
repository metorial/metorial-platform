package providerdeployments

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsUpdateOutputLockedVersion represents the provider deployments update output locked version type.
type ProviderDeploymentsUpdateOutputLockedVersion struct {
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

// ProviderDeploymentsUpdateOutputDefaultConfig represents the provider deployments update output default config type.
type ProviderDeploymentsUpdateOutputDefaultConfig struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Config ID
	Id string `json:"id"`
	// IsDefault - Whether this is the default config
	IsDefault bool `json:"is_default"`
	// Name - Config name
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

// ProviderDeploymentsUpdateOutput represents the provider deployments update output type.
type ProviderDeploymentsUpdateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique deployment identifier
	Id string `json:"id"`
	// IsDefault - Whether this is the default deployment
	IsDefault bool `json:"is_default"`
	// Name - Display name
	Name *string `json:"name,omitempty"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderId - Provider ID
	ProviderId    string                                        `json:"provider_id"`
	LockedVersion *ProviderDeploymentsUpdateOutputLockedVersion `json:"locked_version,omitempty"`
	DefaultConfig *ProviderDeploymentsUpdateOutputDefaultConfig `json:"default_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsUpdateOutputFromJSON deserializes JSON data into a ProviderDeploymentsUpdateOutput.
func MapProviderDeploymentsUpdateOutputFromJSON(data []byte) (*ProviderDeploymentsUpdateOutput, error) {
	var v ProviderDeploymentsUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsUpdateOutputToJSON serializes a ProviderDeploymentsUpdateOutput to JSON.
func MapProviderDeploymentsUpdateOutputToJSON(v *ProviderDeploymentsUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsUpdateBody represents the provider deployments update body type.
type ProviderDeploymentsUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// MapProviderDeploymentsUpdateBodyFromJSON deserializes JSON data into a ProviderDeploymentsUpdateBody.
func MapProviderDeploymentsUpdateBodyFromJSON(data []byte) (*ProviderDeploymentsUpdateBody, error) {
	var v ProviderDeploymentsUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsUpdateBodyToJSON serializes a ProviderDeploymentsUpdateBody to JSON.
func MapProviderDeploymentsUpdateBodyToJSON(v *ProviderDeploymentsUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
