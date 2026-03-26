package configs

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsConfigsCreateOutputDeployment represents the provider deployments configs create output deployment type.
type ProviderDeploymentsConfigsCreateOutputDeployment struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Deployment ID
	Id string `json:"id"`
	// IsDefault - Whether this is the default deployment
	IsDefault bool `json:"is_default"`
	// Name - Deployment name
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

// ProviderDeploymentsConfigsCreateOutputFromVaultDeployment represents the provider deployments configs create output from vault deployment type.
type ProviderDeploymentsConfigsCreateOutputFromVaultDeployment struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Deployment ID
	Id string `json:"id"`
	// IsDefault - Whether this is the default deployment
	IsDefault bool `json:"is_default"`
	// Name - Deployment name
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

// ProviderDeploymentsConfigsCreateOutputFromVault represents the provider deployments configs create output from vault type.
type ProviderDeploymentsConfigsCreateOutputFromVault struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique config vault identifier
	Id string `json:"id"`
	// Name - Display name
	Name string `json:"name"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderId - Provider ID
	ProviderId string                                                     `json:"provider_id"`
	Deployment *ProviderDeploymentsConfigsCreateOutputFromVaultDeployment `json:"deployment,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsConfigsCreateOutput represents the provider deployments configs create output type.
type ProviderDeploymentsConfigsCreateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique config identifier
	Id string `json:"id"`
	// IsDefault - Whether this is the default config
	IsDefault bool `json:"is_default"`
	// Name - Display name
	Name *string `json:"name,omitempty"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SpecificationId - Specification ID
	SpecificationId string                                            `json:"specification_id"`
	Deployment      *ProviderDeploymentsConfigsCreateOutputDeployment `json:"deployment,omitempty"`
	FromVault       *ProviderDeploymentsConfigsCreateOutputFromVault  `json:"from_vault,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsConfigsCreateOutputFromJSON deserializes JSON data into a ProviderDeploymentsConfigsCreateOutput.
func MapProviderDeploymentsConfigsCreateOutputFromJSON(data []byte) (*ProviderDeploymentsConfigsCreateOutput, error) {
	var v ProviderDeploymentsConfigsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigsCreateOutputToJSON serializes a ProviderDeploymentsConfigsCreateOutput to JSON.
func MapProviderDeploymentsConfigsCreateOutputToJSON(v *ProviderDeploymentsConfigsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsConfigsCreateBody represents the provider deployments configs create body type.
type ProviderDeploymentsConfigsCreateBody struct {
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderDeploymentId - Optional provider deployment ID
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	Name                 *string `json:"name,omitempty"`
	Description          *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Value - Provider-specific configuration values
	Value *map[string]any `json:"value,omitempty"`
	// ProviderConfigVaultId - Config vault ID to use as template
	ProviderConfigVaultId *string `json:"provider_config_vault_id,omitempty"`
}

// MapProviderDeploymentsConfigsCreateBodyFromJSON deserializes JSON data into a ProviderDeploymentsConfigsCreateBody.
func MapProviderDeploymentsConfigsCreateBodyFromJSON(data []byte) (*ProviderDeploymentsConfigsCreateBody, error) {
	var v ProviderDeploymentsConfigsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigsCreateBodyToJSON serializes a ProviderDeploymentsConfigsCreateBody to JSON.
func MapProviderDeploymentsConfigsCreateBodyToJSON(v *ProviderDeploymentsConfigsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
