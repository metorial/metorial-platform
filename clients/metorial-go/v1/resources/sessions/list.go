package sessions

import (
	"encoding/json"
	"time"
)

// SessionsListOutputItemsUsage represents the sessions list output items usage type.
type SessionsListOutputItemsUsage struct {
	// TotalProductiveClientMessageCount - Total productive client messages
	TotalProductiveClientMessageCount float64 `json:"total_productive_client_message_count"`
	// TotalProductiveProviderMessageCount - Total productive provider messages
	TotalProductiveProviderMessageCount float64 `json:"total_productive_provider_message_count"`
}

// SessionsListOutputItemsProvidersUsage - Usage statistics
type SessionsListOutputItemsProvidersUsage struct {
	// TotalProductiveClientMessageCount - Total productive client messages
	TotalProductiveClientMessageCount float64 `json:"total_productive_client_message_count"`
	// TotalProductiveProviderMessageCount - Total productive provider messages
	TotalProductiveProviderMessageCount float64 `json:"total_productive_provider_message_count"`
}

// SessionsListOutputItemsProvidersToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionsListOutputItemsProvidersToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionsListOutputItemsProvidersDeployment represents the sessions list output items providers deployment type.
type SessionsListOutputItemsProvidersDeployment struct {
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

// SessionsListOutputItemsProvidersConfig represents the sessions list output items providers config type.
type SessionsListOutputItemsProvidersConfig struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Config ID
	Id string `json:"id"`
	// IsDefault - Whether this is the default config
	IsDefault bool `json:"is_default"`
	// Name - Config name
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

// SessionsListOutputItemsProvidersAuthConfig represents the sessions list output items providers auth config type.
type SessionsListOutputItemsProvidersAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionsListOutputItemsProviders represents the sessions list output items providers type.
type SessionsListOutputItemsProviders struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// Usage - Usage statistics
	Usage SessionsListOutputItemsProvidersUsage `json:"usage"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionsListOutputItemsProvidersToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// FromTemplateId - Source template ID
	FromTemplateId *string `json:"from_template_id,omitempty"`
	// FromTemplateProviderId - Source template provider ID
	FromTemplateProviderId *string                                     `json:"from_template_provider_id,omitempty"`
	Deployment             SessionsListOutputItemsProvidersDeployment  `json:"deployment"`
	Config                 SessionsListOutputItemsProvidersConfig      `json:"config"`
	AuthConfig             *SessionsListOutputItemsProvidersAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionsListOutputItems represents the sessions list output items type.
type SessionsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session identifier
	Id string `json:"id"`
	// Name - Display name
	Name *string `json:"name,omitempty"`
	// Description - Description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// ConnectionState - Session connection state
	ConnectionState string `json:"connection_state"`
	// ConnectionUrl - MCP connection URL for this session
	ConnectionUrl string `json:"connection_url"`
	// ClientSecret - Session-scoped fine grained client secret token
	ClientSecret *string                      `json:"client_secret,omitempty"`
	Usage        SessionsListOutputItemsUsage `json:"usage"`
	// Providers - Session providers
	Providers []SessionsListOutputItemsProviders `json:"providers"`
	// FromTemplatesIds - Template IDs this session was created from
	FromTemplatesIds []string `json:"from_templates_ids"`
	// HasErrors - Whether the session has any errors
	HasErrors bool `json:"has_errors"`
	// HasWarnings - Whether the session has any warnings
	HasWarnings bool `json:"has_warnings"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionsListOutputPagination represents the sessions list output pagination type.
type SessionsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// SessionsListOutput represents the sessions list output type.
type SessionsListOutput struct {
	Items      []SessionsListOutputItems    `json:"items"`
	Pagination SessionsListOutputPagination `json:"pagination"`
}

// MapSessionsListOutputFromJSON deserializes JSON data into a SessionsListOutput.
func MapSessionsListOutputFromJSON(data []byte) (*SessionsListOutput, error) {
	var v SessionsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsListOutputToJSON serializes a SessionsListOutput to JSON.
func MapSessionsListOutputToJSON(v *SessionsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionsListQuery represents the sessions list query type.
type SessionsListQuery struct {
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

// MapSessionsListQueryFromJSON deserializes JSON data into a SessionsListQuery.
func MapSessionsListQueryFromJSON(data []byte) (*SessionsListQuery, error) {
	var v SessionsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsListQueryToJSON serializes a SessionsListQuery to JSON.
func MapSessionsListQueryToJSON(v *SessionsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
