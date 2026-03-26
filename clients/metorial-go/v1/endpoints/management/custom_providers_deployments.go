package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/customproviders/deployments"
)

// CustomProvidersDeploymentsEndpoint provides access to deployments track the build and deployment process of custom provider versions. View deployment status and logs.
type CustomProvidersDeploymentsEndpoint struct {
	client *endpoint.Client
}

// NewCustomProvidersDeploymentsEndpoint creates a new CustomProvidersDeploymentsEndpoint.
func NewCustomProvidersDeploymentsEndpoint(client *endpoint.Client) *CustomProvidersDeploymentsEndpoint {
	return &CustomProvidersDeploymentsEndpoint{client: client}
}

// CustomProvidersDeploymentsEndpointListParams contains optional query parameters for List.
type CustomProvidersDeploymentsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by status (queued, deploying, succeeded, failed)
	Status *any `json:"status,omitempty"`
	// Id - Filter by deployment IDs
	Id *any `json:"id,omitempty"`
	// CustomProviderVersionId - Filter by version IDs
	CustomProviderVersionId *any `json:"custom_provider_version_id,omitempty"`
	// CustomProviderId - Filter by custom provider IDs
	CustomProviderId *any `json:"custom_provider_id,omitempty"`
}

// List returns a paginated list of deployments for a custom provider.
func (e *CustomProvidersDeploymentsEndpoint) List(instanceId string, params *CustomProvidersDeploymentsEndpointListParams) (*deployments.CustomProvidersDeploymentsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "custom-provider-deployments"},
		Query: query,
	}
	var result deployments.CustomProvidersDeploymentsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific deployment.
func (e *CustomProvidersDeploymentsEndpoint) Get(instanceId string, customProviderDeploymentId string) (*deployments.CustomProvidersDeploymentsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "custom-provider-deployments", customProviderDeploymentId},
	}
	var result deployments.CustomProvidersDeploymentsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetLogs retrieves the build and deployment logs for a deployment.
func (e *CustomProvidersDeploymentsEndpoint) GetLogs(instanceId string, customProviderDeploymentId string) (*deployments.CustomProvidersDeploymentsGetLogsOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "custom-provider-deployments", customProviderDeploymentId, "logs"},
	}
	var result deployments.CustomProvidersDeploymentsGetLogsOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
