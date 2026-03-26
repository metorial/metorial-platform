package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/sessiontemplates"
)

// SessionTemplatesEndpoint provides access to session templates define reusable configurations for sessions, including which providers to include. Templates can be used to quickly create new sessions with consistent settings.
type SessionTemplatesEndpoint struct {
	client *endpoint.Client
}

// NewSessionTemplatesEndpoint creates a new SessionTemplatesEndpoint.
func NewSessionTemplatesEndpoint(client *endpoint.Client) *SessionTemplatesEndpoint {
	return &SessionTemplatesEndpoint{client: client}
}

// SessionTemplatesEndpointListParams contains optional query parameters for List.
type SessionTemplatesEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by status (active, archived)
	Status *any `json:"status,omitempty"`
	// Id - Filter by session template ID(s)
	Id *any `json:"id,omitempty"`
	// SessionId - Filter templates that include sessions with these IDs
	SessionId *any `json:"session_id,omitempty"`
	// SessionProviderId - Filter templates that include session providers with these IDs
	SessionProviderId *any `json:"session_provider_id,omitempty"`
	// ProviderId - Filter templates that include providers with these IDs
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderDeploymentId - Filter templates that include provider deployments with these IDs
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderConfigId - Filter templates that include provider configs with these IDs
	ProviderConfigId *any `json:"provider_config_id,omitempty"`
	// ProviderAuthConfigId - Filter templates that include provider auth configs with these IDs
	ProviderAuthConfigId *any `json:"provider_auth_config_id,omitempty"`
}

// SessionTemplatesEndpointCreateBody contains the request body for Create.
type SessionTemplatesEndpointCreateBody struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Providers - Optional list of providers to include in the template
	Providers *[]map[string]any `json:"providers,omitempty"`
}

// SessionTemplatesEndpointUpdateBody contains the request body for Update.
type SessionTemplatesEndpointUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// List returns a paginated list of session templates.
func (e *SessionTemplatesEndpoint) List(params *SessionTemplatesEndpointListParams) (*sessiontemplates.SessionTemplatesListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"session-templates"},
		Query: query,
	}
	var result sessiontemplates.SessionTemplatesListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific session template by ID.
func (e *SessionTemplatesEndpoint) Get(sessionTemplateId string) (*sessiontemplates.SessionTemplatesGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-templates", sessionTemplateId},
	}
	var result sessiontemplates.SessionTemplatesGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new session template.
func (e *SessionTemplatesEndpoint) Create(body *SessionTemplatesEndpointCreateBody) (*sessiontemplates.SessionTemplatesCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-templates"},
		Body: body,
	}
	var result sessiontemplates.SessionTemplatesCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates a specific session template.
func (e *SessionTemplatesEndpoint) Update(sessionTemplateId string, body *SessionTemplatesEndpointUpdateBody) (*sessiontemplates.SessionTemplatesUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"session-templates", sessionTemplateId},
		Body: body,
	}
	var result sessiontemplates.SessionTemplatesUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
