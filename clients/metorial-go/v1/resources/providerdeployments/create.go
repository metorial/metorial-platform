package providerdeployments

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsCreateOutputLockedVersion represents the provider deployments create output locked version type.
type ProviderDeploymentsCreateOutputLockedVersion struct {
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

// ProviderDeploymentsCreateOutputDefaultConfig represents the provider deployments create output default config type.
type ProviderDeploymentsCreateOutputDefaultConfig struct {
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

// ProviderDeploymentsCreateOutput represents the provider deployments create output type.
type ProviderDeploymentsCreateOutput struct {
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
	LockedVersion *ProviderDeploymentsCreateOutputLockedVersion `json:"locked_version,omitempty"`
	DefaultConfig *ProviderDeploymentsCreateOutputDefaultConfig `json:"default_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsCreateOutputFromJSON deserializes JSON data into a ProviderDeploymentsCreateOutput.
func MapProviderDeploymentsCreateOutputFromJSON(data []byte) (*ProviderDeploymentsCreateOutput, error) {
	var v ProviderDeploymentsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsCreateOutputToJSON serializes a ProviderDeploymentsCreateOutput to JSON.
func MapProviderDeploymentsCreateOutputToJSON(v *ProviderDeploymentsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsCreateBodyProviderConfig represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type ProviderDeploymentsCreateBodyProviderConfig struct {
	Name *string `json:"name,omitempty"`
	// Value - Provider-specific configuration values
	Value *map[string]any `json:"value,omitempty"`
	// ProviderConfigVaultId - Provider config vault ID
	ProviderConfigVaultId *string `json:"provider_config_vault_id,omitempty"`
}

// ProviderDeploymentsCreateBody represents the provider deployments create body type.
type ProviderDeploymentsCreateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderId - The provider to deploy
	ProviderId string `json:"provider_id"`
	// LockedProviderVersionId - Pin this deployment to a specific provider version
	LockedProviderVersionId *string `json:"locked_provider_version_id,omitempty"`
	// ProviderConfigId - Existing provider config ID
	ProviderConfigId *string                                      `json:"provider_config_id,omitempty"`
	ProviderConfig   *ProviderDeploymentsCreateBodyProviderConfig `json:"provider_config,omitempty"`
}

// MapProviderDeploymentsCreateBodyFromJSON deserializes JSON data into a ProviderDeploymentsCreateBody.
func MapProviderDeploymentsCreateBodyFromJSON(data []byte) (*ProviderDeploymentsCreateBody, error) {
	var v ProviderDeploymentsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsCreateBodyToJSON serializes a ProviderDeploymentsCreateBody to JSON.
func MapProviderDeploymentsCreateBodyToJSON(v *ProviderDeploymentsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
