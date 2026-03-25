package configvaults

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsConfigVaultsUpdateOutputDeployment represents the provider deployments config vaults update output deployment type.
type ProviderDeploymentsConfigVaultsUpdateOutputDeployment struct {
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

// ProviderDeploymentsConfigVaultsUpdateOutput represents the provider deployments config vaults update output type.
type ProviderDeploymentsConfigVaultsUpdateOutput struct {
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
	Deployment *ProviderDeploymentsConfigVaultsUpdateOutputDeployment `json:"deployment,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsConfigVaultsUpdateOutputFromJSON deserializes JSON data into a ProviderDeploymentsConfigVaultsUpdateOutput.
func MapProviderDeploymentsConfigVaultsUpdateOutputFromJSON(data []byte) (*ProviderDeploymentsConfigVaultsUpdateOutput, error) {
	var v ProviderDeploymentsConfigVaultsUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigVaultsUpdateOutputToJSON serializes a ProviderDeploymentsConfigVaultsUpdateOutput to JSON.
func MapProviderDeploymentsConfigVaultsUpdateOutputToJSON(v *ProviderDeploymentsConfigVaultsUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsConfigVaultsUpdateBody represents the provider deployments config vaults update body type.
type ProviderDeploymentsConfigVaultsUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// MapProviderDeploymentsConfigVaultsUpdateBodyFromJSON deserializes JSON data into a ProviderDeploymentsConfigVaultsUpdateBody.
func MapProviderDeploymentsConfigVaultsUpdateBodyFromJSON(data []byte) (*ProviderDeploymentsConfigVaultsUpdateBody, error) {
	var v ProviderDeploymentsConfigVaultsUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsConfigVaultsUpdateBodyToJSON serializes a ProviderDeploymentsConfigVaultsUpdateBody to JSON.
func MapProviderDeploymentsConfigVaultsUpdateBodyToJSON(v *ProviderDeploymentsConfigVaultsUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
