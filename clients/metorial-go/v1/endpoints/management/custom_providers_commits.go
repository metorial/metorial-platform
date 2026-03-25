package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/customproviders/commits"
)

// CustomProvidersCommitsEndpoint provides access to commits represent version promotions between environments. Merge versions from one environment to another or rollback to a previous version.
type CustomProvidersCommitsEndpoint struct {
	client *endpoint.Client
}

// NewCustomProvidersCommitsEndpoint creates a new CustomProvidersCommitsEndpoint.
func NewCustomProvidersCommitsEndpoint(client *endpoint.Client) *CustomProvidersCommitsEndpoint {
	return &CustomProvidersCommitsEndpoint{client: client}
}

// CustomProvidersCommitsEndpointListParams contains optional query parameters for List.
type CustomProvidersCommitsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by commit IDs
	Id *any `json:"id,omitempty"`
	// CustomProviderVersionId - Filter by version IDs
	CustomProviderVersionId *any `json:"custom_provider_version_id,omitempty"`
	// CustomProviderEnvironmentId - Filter by environment IDs
	CustomProviderEnvironmentId *any `json:"custom_provider_environment_id,omitempty"`
	// CustomProviderId - Filter by custom provider IDs
	CustomProviderId *any `json:"custom_provider_id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
}

// CustomProvidersCommitsEndpointCreateBody contains the request body for Create.
type CustomProvidersCommitsEndpointCreateBody struct {
	// Message - Commit message
	Message string `json:"message"`
	// Action - The commit action to perform
	Action any `json:"action"`
}

// List returns a paginated list of commits for a custom provider.
func (e *CustomProvidersCommitsEndpoint) List(instanceId string, params *CustomProvidersCommitsEndpointListParams) (*commits.CustomProvidersCommitsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "custom-provider-commits"},
		Query: query,
	}
	var result commits.CustomProvidersCommitsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific commit.
func (e *CustomProvidersCommitsEndpoint) Get(instanceId string, customProviderCommitId string) (*commits.CustomProvidersCommitsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "custom-provider-commits", customProviderCommitId},
	}
	var result commits.CustomProvidersCommitsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new commit to promote or rollback a version in an environment.
func (e *CustomProvidersCommitsEndpoint) Create(instanceId string, body *CustomProvidersCommitsEndpointCreateBody) (*commits.CustomProvidersCommitsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "custom-provider-commits"},
		Body: body,
	}
	var result commits.CustomProvidersCommitsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
