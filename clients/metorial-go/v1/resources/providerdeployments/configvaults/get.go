package configvaults

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsConfigVaultsGetOutputDeployment represents the provider deployments config vaults get output deployment type.
type ProviderDeploymentsConfigVaultsGetOutputDeployment struct {
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

// ProviderDeploymentsConfigVaultsGetOutput represents the provider deployments config vaults get output type.
type ProviderDeploymentsConfigVaultsGetOutput struct {
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
	ProviderId string                                              `json:"provider_id"`
	Deployment *ProviderDeploymentsConfigVaultsGetOutputDeployment `json:"deployment,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsConfigVaultsGetOutputFromJSON deserializes JSON data into a ProviderDeploymentsConfigVaultsGetOutput.
func MapProviderDeploymentsConfigVaultsGetOutputFromJSON(data []byte) (*ProviderDeploymentsConfigVaultsGetOutput, error) {
	var v ProviderDeploymentsConfigVaultsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigVaultsGetOutputToJSON serializes a ProviderDeploymentsConfigVaultsGetOutput to JSON.
func MapProviderDeploymentsConfigVaultsGetOutputToJSON(v *ProviderDeploymentsConfigVaultsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
