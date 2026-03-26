package configvaults

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsConfigVaultsCreateOutputDeployment represents the provider deployments config vaults create output deployment type.
type ProviderDeploymentsConfigVaultsCreateOutputDeployment struct {
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

// ProviderDeploymentsConfigVaultsCreateOutput represents the provider deployments config vaults create output type.
type ProviderDeploymentsConfigVaultsCreateOutput struct {
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
	Deployment *ProviderDeploymentsConfigVaultsCreateOutputDeployment `json:"deployment,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsConfigVaultsCreateOutputFromJSON deserializes JSON data into a ProviderDeploymentsConfigVaultsCreateOutput.
func MapProviderDeploymentsConfigVaultsCreateOutputFromJSON(data []byte) (*ProviderDeploymentsConfigVaultsCreateOutput, error) {
	var v ProviderDeploymentsConfigVaultsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigVaultsCreateOutputToJSON serializes a ProviderDeploymentsConfigVaultsCreateOutput to JSON.
func MapProviderDeploymentsConfigVaultsCreateOutputToJSON(v *ProviderDeploymentsConfigVaultsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsConfigVaultsCreateBody represents the provider deployments config vaults create body type.
type ProviderDeploymentsConfigVaultsCreateBody struct {
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// ProviderDeploymentId - Provider deployment ID
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	Name                 string  `json:"name"`
	Description          *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Value - Secure configuration values to store in the vault
	Value map[string]any `json:"value"`
}

// MapProviderDeploymentsConfigVaultsCreateBodyFromJSON deserializes JSON data into a ProviderDeploymentsConfigVaultsCreateBody.
func MapProviderDeploymentsConfigVaultsCreateBodyFromJSON(data []byte) (*ProviderDeploymentsConfigVaultsCreateBody, error) {
	var v ProviderDeploymentsConfigVaultsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigVaultsCreateBodyToJSON serializes a ProviderDeploymentsConfigVaultsCreateBody to JSON.
func MapProviderDeploymentsConfigVaultsCreateBodyToJSON(v *ProviderDeploymentsConfigVaultsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
