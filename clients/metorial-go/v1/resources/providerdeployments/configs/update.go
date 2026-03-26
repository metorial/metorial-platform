package configs

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsConfigsUpdateOutputDeployment represents the provider deployments configs update output deployment type.
type ProviderDeploymentsConfigsUpdateOutputDeployment struct {
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

// ProviderDeploymentsConfigsUpdateOutputFromVaultDeployment represents the provider deployments configs update output from vault deployment type.
type ProviderDeploymentsConfigsUpdateOutputFromVaultDeployment struct {
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

// ProviderDeploymentsConfigsUpdateOutputFromVault represents the provider deployments configs update output from vault type.
type ProviderDeploymentsConfigsUpdateOutputFromVault struct {
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
	Deployment *ProviderDeploymentsConfigsUpdateOutputFromVaultDeployment `json:"deployment,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderDeploymentsConfigsUpdateOutput represents the provider deployments configs update output type.
type ProviderDeploymentsConfigsUpdateOutput struct {
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
	Deployment      *ProviderDeploymentsConfigsUpdateOutputDeployment `json:"deployment,omitempty"`
	FromVault       *ProviderDeploymentsConfigsUpdateOutputFromVault  `json:"from_vault,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsConfigsUpdateOutputFromJSON deserializes JSON data into a ProviderDeploymentsConfigsUpdateOutput.
func MapProviderDeploymentsConfigsUpdateOutputFromJSON(data []byte) (*ProviderDeploymentsConfigsUpdateOutput, error) {
	var v ProviderDeploymentsConfigsUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigsUpdateOutputToJSON serializes a ProviderDeploymentsConfigsUpdateOutput to JSON.
func MapProviderDeploymentsConfigsUpdateOutputToJSON(v *ProviderDeploymentsConfigsUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsConfigsUpdateBody represents the provider deployments configs update body type.
type ProviderDeploymentsConfigsUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// MapProviderDeploymentsConfigsUpdateBodyFromJSON deserializes JSON data into a ProviderDeploymentsConfigsUpdateBody.
func MapProviderDeploymentsConfigsUpdateBodyFromJSON(data []byte) (*ProviderDeploymentsConfigsUpdateBody, error) {
	var v ProviderDeploymentsConfigsUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigsUpdateBodyToJSON serializes a ProviderDeploymentsConfigsUpdateBody to JSON.
func MapProviderDeploymentsConfigsUpdateBodyToJSON(v *ProviderDeploymentsConfigsUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
