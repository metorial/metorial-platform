package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/sessiontemplates/providers"
)

// SessionTemplatesProvidersEndpoint provides access to session template providers define which providers should be included when a session is created from a template.
type SessionTemplatesProvidersEndpoint struct {
	client *endpoint.Client
}

// NewSessionTemplatesProvidersEndpoint creates a new SessionTemplatesProvidersEndpoint.
func NewSessionTemplatesProvidersEndpoint(client *endpoint.Client) *SessionTemplatesProvidersEndpoint {
	return &SessionTemplatesProvidersEndpoint{client: client}
}

// SessionTemplatesProvidersEndpointListParams contains optional query parameters for List.
type SessionTemplatesProvidersEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	Status *any     `json:"status,omitempty"`
	// Id - Filter by session template provider ID(s)
	Id *any `json:"id,omitempty"`
	// SessionTemplateId - Filter by session template ID(s)
	SessionTemplateId *any `json:"session_template_id,omitempty"`
	// SessionTemplateTemplateId - Filter by session template template ID(s)
	SessionTemplateTemplateId *any `json:"session_template_template_id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID(s)
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderConfigId - Filter by provider config ID(s)
	ProviderConfigId *any `json:"provider_config_id,omitempty"`
	// ProviderAuthConfigId - Filter by provider auth config ID(s)
	ProviderAuthConfigId *any `json:"provider_auth_config_id,omitempty"`
}

// SessionTemplatesProvidersEndpointCreateBody contains the request body for Create.
type SessionTemplatesProvidersEndpointCreateBody struct {
	SessionTemplateId     string  `json:"session_template_id"`
	ProviderDeploymentId  *string `json:"provider_deployment_id,omitempty"`
	ProviderConfigId      *string `json:"provider_config_id,omitempty"`
	ProviderConfigVaultId *string `json:"provider_config_vault_id,omitempty"`
	ProviderAuthConfigId  *string `json:"provider_auth_config_id,omitempty"`
	ToolFilters           *any    `json:"tool_filters,omitempty"`
}

// SessionTemplatesProvidersEndpointUpdateBody contains the request body for Update.
type SessionTemplatesProvidersEndpointUpdateBody struct {
	ToolFilters *any `json:"tool_filters,omitempty"`
}

// List returns a paginated list of providers configured for a session template.
func (e *SessionTemplatesProvidersEndpoint) List(params *SessionTemplatesProvidersEndpointListParams) (*providers.SessionTemplatesProvidersListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"session-template-providers"},
		Query: query,
	}
	var result providers.SessionTemplatesProvidersListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider configuration from a session template.
func (e *SessionTemplatesProvidersEndpoint) Get(sessionTemplateProviderId string) (*providers.SessionTemplatesProvidersGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-template-providers", sessionTemplateProviderId},
	}
	var result providers.SessionTemplatesProvidersGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create adds a new provider configuration to a session template.
func (e *SessionTemplatesProvidersEndpoint) Create(body *SessionTemplatesProvidersEndpointCreateBody) (*providers.SessionTemplatesProvidersCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-template-providers"},
		Body: body,
	}
	var result providers.SessionTemplatesProvidersCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a provider configuration in a session template.
func (e *SessionTemplatesProvidersEndpoint) Update(sessionTemplateProviderId string, body *SessionTemplatesProvidersEndpointUpdateBody) (*providers.SessionTemplatesProvidersUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-template-providers", sessionTemplateProviderId},
		Body: body,
	}
	var result providers.SessionTemplatesProvidersUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete removes a provider configuration from a session template.
func (e *SessionTemplatesProvidersEndpoint) Delete(sessionTemplateProviderId string) (*providers.SessionTemplatesProvidersDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-template-providers", sessionTemplateProviderId},
	}
	var result providers.SessionTemplatesProvidersDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
