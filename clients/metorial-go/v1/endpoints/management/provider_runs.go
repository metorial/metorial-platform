package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providerruns"
)

// ProviderRunsEndpoint provides access to provider runs track the execution of provider operations within a session. This read-only resource provides visibility into provider activity.
type ProviderRunsEndpoint struct {
	client *endpoint.Client
}

// NewProviderRunsEndpoint creates a new ProviderRunsEndpoint.
func NewProviderRunsEndpoint(client *endpoint.Client) *ProviderRunsEndpoint {
	return &ProviderRunsEndpoint{client: client}
}

// ProviderRunsEndpointListParams contains optional query parameters for List.
type ProviderRunsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by run status
	Status *any `json:"status,omitempty"`
	// Id - Filter by provider run ID(s)
	Id *any `json:"id,omitempty"`
	// SessionId - Filter by session ID(s)
	SessionId *any `json:"session_id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// SessionProviderId - Filter by session provider ID(s)
	SessionProviderId *any `json:"session_provider_id,omitempty"`
	// SessionConnectionId - Filter by session connection ID(s)
	SessionConnectionId *any `json:"session_connection_id,omitempty"`
	// ProviderVersionId - Filter by provider version ID(s)
	ProviderVersionId *any `json:"provider_version_id,omitempty"`
}

// List returns a paginated list of provider runs across all sessions.
func (e *ProviderRunsEndpoint) List(instanceId string, params *ProviderRunsEndpointListParams) (*providerruns.ProviderRunsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-runs"},
		Query: query,
	}
	var result providerruns.ProviderRunsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider run by ID.
func (e *ProviderRunsEndpoint) Get(instanceId string, providerRunId string) (*providerruns.ProviderRunsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-runs", providerRunId},
	}
	var result providerruns.ProviderRunsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetLogs retrieves the logs for a specific provider run.
func (e *ProviderRunsEndpoint) GetLogs(instanceId string, providerRunId string) (*providerruns.ProviderRunsGetLogsOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-runs", providerRunId, "logs"},
	}
	var result providerruns.ProviderRunsGetLogsOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
