package providerdeployments

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsGetOutputLockedVersion represents the provider deployments get output locked version type.
type ProviderDeploymentsGetOutputLockedVersion struct {
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

// ProviderDeploymentsGetOutputDefaultConfig represents the provider deployments get output default config type.
type ProviderDeploymentsGetOutputDefaultConfig struct {
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

// ProviderDeploymentsGetOutput represents the provider deployments get output type.
type ProviderDeploymentsGetOutput struct {
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
	ProviderId    string                                     `json:"provider_id"`
	LockedVersion *ProviderDeploymentsGetOutputLockedVersion `json:"locked_version,omitempty"`
	DefaultConfig *ProviderDeploymentsGetOutputDefaultConfig `json:"default_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsGetOutputFromJSON deserializes JSON data into a ProviderDeploymentsGetOutput.
func MapProviderDeploymentsGetOutputFromJSON(data []byte) (*ProviderDeploymentsGetOutput, error) {
	var v ProviderDeploymentsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsGetOutputToJSON serializes a ProviderDeploymentsGetOutput to JSON.
func MapProviderDeploymentsGetOutputToJSON(v *ProviderDeploymentsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
