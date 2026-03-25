package providers

import (
	"encoding/json"
	"time"
)

// SessionsProvidersListOutputItemsUsage - Usage statistics
type SessionsProvidersListOutputItemsUsage struct {
	// TotalProductiveClientMessageCount - Total productive client messages
	TotalProductiveClientMessageCount float64 `json:"total_productive_client_message_count"`
	// TotalProductiveProviderMessageCount - Total productive provider messages
	TotalProductiveProviderMessageCount float64 `json:"total_productive_provider_message_count"`
}

// SessionsProvidersListOutputItemsToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionsProvidersListOutputItemsToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionsProvidersListOutputItemsDeployment represents the sessions providers list output items deployment type.
type SessionsProvidersListOutputItemsDeployment struct {
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

// SessionsProvidersListOutputItemsConfig represents the sessions providers list output items config type.
type SessionsProvidersListOutputItemsConfig struct {
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

// SessionsProvidersListOutputItemsAuthConfig represents the sessions providers list output items auth config type.
type SessionsProvidersListOutputItemsAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionsProvidersListOutputItems represents the sessions providers list output items type.
type SessionsProvidersListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// Usage - Usage statistics
	Usage SessionsProvidersListOutputItemsUsage `json:"usage"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionsProvidersListOutputItemsToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// FromTemplateId - Source template ID
	FromTemplateId *string `json:"from_template_id,omitempty"`
	// FromTemplateProviderId - Source template provider ID
	FromTemplateProviderId *string                                     `json:"from_template_provider_id,omitempty"`
	Deployment             SessionsProvidersListOutputItemsDeployment  `json:"deployment"`
	Config                 SessionsProvidersListOutputItemsConfig      `json:"config"`
	AuthConfig             *SessionsProvidersListOutputItemsAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionsProvidersListOutputPagination represents the sessions providers list output pagination type.
type SessionsProvidersListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// SessionsProvidersListOutput represents the sessions providers list output type.
type SessionsProvidersListOutput struct {
	Items      []SessionsProvidersListOutputItems    `json:"items"`
	Pagination SessionsProvidersListOutputPagination `json:"pagination"`
}

// MapSessionsProvidersListOutputFromJSON deserializes JSON data into a SessionsProvidersListOutput.
func MapSessionsProvidersListOutputFromJSON(data []byte) (*SessionsProvidersListOutput, error) {
	var v SessionsProvidersListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsProvidersListOutputToJSON serializes a SessionsProvidersListOutput to JSON.
func MapSessionsProvidersListOutputToJSON(v *SessionsProvidersListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionsProvidersListQuery represents the sessions providers list query type.
type SessionsProvidersListQuery struct {
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

// MapSessionsProvidersListQueryFromJSON deserializes JSON data into a SessionsProvidersListQuery.
func MapSessionsProvidersListQueryFromJSON(data []byte) (*SessionsProvidersListQuery, error) {
	var v SessionsProvidersListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsProvidersListQueryToJSON serializes a SessionsProvidersListQuery to JSON.
func MapSessionsProvidersListQueryToJSON(v *SessionsProvidersListQuery) ([]byte, error) {
	return json.Marshal(v)
}
