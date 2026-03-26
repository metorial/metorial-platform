package imports

import (
	"encoding/json"
	"time"
)

// ProviderDeploymentsAuthConfigsImportsGetSchemaOutputSchema represents the provider deployments auth configs imports get schema output schema type.
type ProviderDeploymentsAuthConfigsImportsGetSchemaOutputSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema for auth import data
	Schema map[string]any `json:"schema"`
}

// ProviderDeploymentsAuthConfigsImportsGetSchemaOutput represents the provider deployments auth configs imports get schema output type.
type ProviderDeploymentsAuthConfigsImportsGetSchemaOutput struct {
	// Object - String representing the object's type
	Object string                                                      `json:"object"`
	Schema *ProviderDeploymentsAuthConfigsImportsGetSchemaOutputSchema `json:"schema,omitempty"`
	// Visibility - Visibility of the auth config data
	Visibility string `json:"visibility"`
	// SpecificationId - Specification ID
	SpecificationId string `json:"specification_id"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderDeploymentsAuthConfigsImportsGetSchemaOutputFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsImportsGetSchemaOutput.
func MapProviderDeploymentsAuthConfigsImportsGetSchemaOutputFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsImportsGetSchemaOutput, error) {
	var v ProviderDeploymentsAuthConfigsImportsGetSchemaOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsImportsGetSchemaOutputToJSON serializes a ProviderDeploymentsAuthConfigsImportsGetSchemaOutput to JSON.
func MapProviderDeploymentsAuthConfigsImportsGetSchemaOutputToJSON(v *ProviderDeploymentsAuthConfigsImportsGetSchemaOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderDeploymentsAuthConfigsImportsGetSchemaQuery represents the provider deployments auth configs imports get schema query type.
type ProviderDeploymentsAuthConfigsImportsGetSchemaQuery struct {
	ProviderId           *string `json:"provider_id,omitempty"`
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	ProviderAuthConfigId *string `json:"provider_auth_config_id,omitempty"`
	ProviderAuthMethodId *string `json:"provider_auth_method_id,omitempty"`
}

// MapProviderDeploymentsAuthConfigsImportsGetSchemaQueryFromJSON deserializes JSON data into a ProviderDeploymentsAuthConfigsImportsGetSchemaQuery.
func MapProviderDeploymentsAuthConfigsImportsGetSchemaQueryFromJSON(data []byte) (*ProviderDeploymentsAuthConfigsImportsGetSchemaQuery, error) {
	var v ProviderDeploymentsAuthConfigsImportsGetSchemaQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderDeploymentsAuthConfigsImportsGetSchemaQueryToJSON serializes a ProviderDeploymentsAuthConfigsImportsGetSchemaQuery to JSON.
func MapProviderDeploymentsAuthConfigsImportsGetSchemaQueryToJSON(v *ProviderDeploymentsAuthConfigsImportsGetSchemaQuery) ([]byte, error) {
	return json.Marshal(v)
}
