package providerdeployments

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsDeleteOutputLockedVersion represents the provider deployments delete output locked version type.
type ProviderDeploymentsDeleteOutputLockedVersion struct {
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

// ProviderDeploymentsDeleteOutputDefaultConfig represents the provider deployments delete output default config type.
type ProviderDeploymentsDeleteOutputDefaultConfig struct {
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

// ProviderDeploymentsDeleteOutput represents the provider deployments delete output type.
type ProviderDeploymentsDeleteOutput struct {
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
	LockedVersion *ProviderDeploymentsDeleteOutputLockedVersion `json:"locked_version,omitempty"`
	DefaultConfig *ProviderDeploymentsDeleteOutputDefaultConfig `json:"default_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsDeleteOutputFromJSON deserializes JSON data into a ProviderDeploymentsDeleteOutput.
func MapProviderDeploymentsDeleteOutputFromJSON(data []byte) (*ProviderDeploymentsDeleteOutput, error) {
	var v ProviderDeploymentsDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsDeleteOutputToJSON serializes a ProviderDeploymentsDeleteOutput to JSON.
func MapProviderDeploymentsDeleteOutputToJSON(v *ProviderDeploymentsDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
