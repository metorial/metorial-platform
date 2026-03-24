package configvaults

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsConfigVaultsDeleteOutputDeployment represents the provider deployments config vaults delete output deployment type.
type ProviderDeploymentsConfigVaultsDeleteOutputDeployment struct {
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

// ProviderDeploymentsConfigVaultsDeleteOutput represents the provider deployments config vaults delete output type.
type ProviderDeploymentsConfigVaultsDeleteOutput struct {
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
	ProviderId string                                                 `json:"provider_id"`
	Deployment *ProviderDeploymentsConfigVaultsDeleteOutputDeployment `json:"deployment,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsConfigVaultsDeleteOutputFromJSON deserializes JSON data into a ProviderDeploymentsConfigVaultsDeleteOutput.
func MapProviderDeploymentsConfigVaultsDeleteOutputFromJSON(data []byte) (*ProviderDeploymentsConfigVaultsDeleteOutput, error) {
	var v ProviderDeploymentsConfigVaultsDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigVaultsDeleteOutputToJSON serializes a ProviderDeploymentsConfigVaultsDeleteOutput to JSON.
func MapProviderDeploymentsConfigVaultsDeleteOutputToJSON(v *ProviderDeploymentsConfigVaultsDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
