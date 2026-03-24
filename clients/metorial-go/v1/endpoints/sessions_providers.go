package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/sessions/providers"
)

// SessionsProvidersEndpoint provides access to session providers represent the providers that are actively connected to a session. Each session can have multiple providers, and providers can be added or removed during the session lifecycle.
type SessionsProvidersEndpoint struct {
	client *endpoint.Client
}

// NewSessionsProvidersEndpoint creates a new SessionsProvidersEndpoint.
func NewSessionsProvidersEndpoint(client *endpoint.Client) *SessionsProvidersEndpoint {
	return &SessionsProvidersEndpoint{client: client}
}

// SessionsProvidersEndpointListParams contains optional query parameters for List.
type SessionsProvidersEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by session provider ID(s)
	Id *any `json:"id,omitempty"`
	// SessionId - Filter by session ID(s)
	SessionId *any `json:"session_id,omitempty"`
	// SessionTemplateId - Filter by session template ID(s)
	SessionTemplateId *any `json:"session_template_id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderConfigId - Filter by provider config ID(s)
	ProviderConfigId *any `json:"provider_config_id,omitempty"`
	// ProviderAuthConfigId - Filter by provider auth config ID(s)
	ProviderAuthConfigId *any `json:"provider_auth_config_id,omitempty"`
	// Status - Filter by provider status
	Status *any `json:"status,omitempty"`
}

// SessionsProvidersEndpointCreateBody contains the request body for Create.
type SessionsProvidersEndpointCreateBody struct {
	SessionId   string `json:"session_id"`
	ToolFilters *any   `json:"tool_filters,omitempty"`
}

// SessionsProvidersEndpointUpdateBody contains the request body for Update.
type SessionsProvidersEndpointUpdateBody struct {
	ToolFilters *any `json:"tool_filters,omitempty"`
}

// List returns a paginated list of providers connected to a session.
func (e *SessionsProvidersEndpoint) List(params *SessionsProvidersEndpointListParams) (*providers.SessionsProvidersListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"session-providers"},
		Query: query,
	}
	var result providers.SessionsProvidersListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider connected to a session.
func (e *SessionsProvidersEndpoint) Get(sessionProviderId string) (*providers.SessionsProvidersGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-providers", sessionProviderId},
	}
	var result providers.SessionsProvidersGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create adds a new provider to an active session.
func (e *SessionsProvidersEndpoint) Create(body *SessionsProvidersEndpointCreateBody) (*providers.SessionsProvidersCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-providers"},
		Body: body,
	}
	var result providers.SessionsProvidersCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a provider connected to a session.
func (e *SessionsProvidersEndpoint) Update(sessionProviderId string, body *SessionsProvidersEndpointUpdateBody) (*providers.SessionsProvidersUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-providers", sessionProviderId},
		Body: body,
	}
	var result providers.SessionsProvidersUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete removes a provider from a session.
func (e *SessionsProvidersEndpoint) Delete(sessionProviderId string) (*providers.SessionsProvidersDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-providers", sessionProviderId},
	}
	var result providers.SessionsProvidersDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
