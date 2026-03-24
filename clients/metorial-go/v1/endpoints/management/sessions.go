package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/sessions"
)

// SessionsEndpoint provides access to sessions are connections to providers that allow clients to interact with MCP servers. Each session can include one or more provider deployments.
type SessionsEndpoint struct {
	client *endpoint.Client
}

// NewSessionsEndpoint creates a new SessionsEndpoint.
func NewSessionsEndpoint(client *endpoint.Client) *SessionsEndpoint {
	return &SessionsEndpoint{client: client}
}

// SessionsEndpointListParams contains optional query parameters for List.
type SessionsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by status (active, archived)
	Status *any `json:"status,omitempty"`
	// Id - Filter by session ID(s)
	Id *any `json:"id,omitempty"`
	// SessionTemplateId - Filter by session template ID(s)
	SessionTemplateId *any `json:"session_template_id,omitempty"`
	// SessionProviderId - Filter by session provider ID(s)
	SessionProviderId *any `json:"session_provider_id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderConfigId - Filter by provider config ID(s)
	ProviderConfigId *any `json:"provider_config_id,omitempty"`
	// ProviderAuthConfigId - Filter by provider auth config ID(s)
	ProviderAuthConfigId *any `json:"provider_auth_config_id,omitempty"`
}

// SessionsEndpointCreateBody contains the request body for Create.
type SessionsEndpointCreateBody struct {
	Name        *string          `json:"name,omitempty"`
	Description *string          `json:"description,omitempty"`
	Metadata    *map[string]any  `json:"metadata,omitempty"`
	Providers   []map[string]any `json:"providers"`
}

// SessionsEndpointUpdateBody contains the request body for Update.
type SessionsEndpointUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// List returns a paginated list of sessions.
func (e *SessionsEndpoint) List(instanceId string, params *SessionsEndpointListParams) (*sessions.SessionsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "sessions"},
		Query: query,
	}
	var result sessions.SessionsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific session by ID.
func (e *SessionsEndpoint) Get(instanceId string, sessionId string) (*sessions.SessionsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "sessions", sessionId},
	}
	var result sessions.SessionsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new session with provider deployments.
func (e *SessionsEndpoint) Create(instanceId string, body *SessionsEndpointCreateBody) (*sessions.SessionsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "sessions"},
		Body: body,
	}
	var result sessions.SessionsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a session.
func (e *SessionsEndpoint) Update(instanceId string, sessionId string, body *SessionsEndpointUpdateBody) (*sessions.SessionsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "sessions", sessionId},
		Body: body,
	}
	var result sessions.SessionsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
