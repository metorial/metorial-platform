package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providerdeployments/authconfigs/imports"
)

// ProviderDeploymentsAuthConfigsImportsEndpoint provides access to an auth import lets you bring in existing OAuth tokens or credentials from another system, so users don't need to re-authenticate to use Metorial.
type ProviderDeploymentsAuthConfigsImportsEndpoint struct {
	client *endpoint.Client
}

// NewProviderDeploymentsAuthConfigsImportsEndpoint creates a new ProviderDeploymentsAuthConfigsImportsEndpoint.
func NewProviderDeploymentsAuthConfigsImportsEndpoint(client *endpoint.Client) *ProviderDeploymentsAuthConfigsImportsEndpoint {
	return &ProviderDeploymentsAuthConfigsImportsEndpoint{client: client}
}

// ProviderDeploymentsAuthConfigsImportsEndpointListParams contains optional query parameters for List.
type ProviderDeploymentsAuthConfigsImportsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by import ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderAuthCredentialsId - Filter by auth credentials ID(s)
	ProviderAuthCredentialsId *any `json:"provider_auth_credentials_id,omitempty"`
	// ProviderAuthConfigId - Filter by auth config ID(s)
	ProviderAuthConfigId *any `json:"provider_auth_config_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
}

// ProviderDeploymentsAuthConfigsImportsEndpointCreateBody contains the request body for Create.
type ProviderDeploymentsAuthConfigsImportsEndpointCreateBody struct {
	ProviderId           *string `json:"provider_id,omitempty"`
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	ProviderAuthConfigId *string `json:"provider_auth_config_id,omitempty"`
	// ProviderAuthMethodId - The authentication method used by these credentials
	ProviderAuthMethodId *string `json:"provider_auth_method_id,omitempty"`
	// Note - A note describing the import source or reason
	Note string `json:"note"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Value - The credential data to import
	Value map[string]any `json:"value"`
}

// ProviderDeploymentsAuthConfigsImportsEndpointGetSchemaParams contains optional query parameters for GetSchema.
type ProviderDeploymentsAuthConfigsImportsEndpointGetSchemaParams struct {
	ProviderId           *string `json:"provider_id,omitempty"`
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	ProviderAuthConfigId *string `json:"provider_auth_config_id,omitempty"`
	ProviderAuthMethodId *string `json:"provider_auth_method_id,omitempty"`
}

// List returns a paginated list of provider auth imports.
func (e *ProviderDeploymentsAuthConfigsImportsEndpoint) List(instanceId string, params *ProviderDeploymentsAuthConfigsImportsEndpointListParams) (*imports.ProviderDeploymentsAuthConfigsImportsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-auth-config-imports"},
		Query: query,
	}
	var result imports.ProviderDeploymentsAuthConfigsImportsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider auth import by ID.
func (e *ProviderDeploymentsAuthConfigsImportsEndpoint) Get(instanceId string, providerAuthImportId string) (*imports.ProviderDeploymentsAuthConfigsImportsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-auth-config-imports", providerAuthImportId},
	}
	var result imports.ProviderDeploymentsAuthConfigsImportsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create imports authentication credentials for a provider.
func (e *ProviderDeploymentsAuthConfigsImportsEndpoint) Create(instanceId string, body *ProviderDeploymentsAuthConfigsImportsEndpointCreateBody) (*imports.ProviderDeploymentsAuthConfigsImportsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-auth-config-imports"},
		Body: body,
	}
	var result imports.ProviderDeploymentsAuthConfigsImportsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetSchema retrieves the JSON Schema for importing authentication credentials.
func (e *ProviderDeploymentsAuthConfigsImportsEndpoint) GetSchema(instanceId string, params *ProviderDeploymentsAuthConfigsImportsEndpointGetSchemaParams) (*imports.ProviderDeploymentsAuthConfigsImportsGetSchemaOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-auth-config-imports", "schema"},
		Query: query,
	}
	var result imports.ProviderDeploymentsAuthConfigsImportsGetSchemaOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
