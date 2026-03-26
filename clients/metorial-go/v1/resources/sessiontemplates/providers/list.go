package providers

import (
	"encoding/json"
	"time"
)

// SessionTemplatesProvidersListOutputItemsToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionTemplatesProvidersListOutputItemsToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionTemplatesProvidersListOutputItemsDeployment represents the session templates providers list output items deployment type.
type SessionTemplatesProvidersListOutputItemsDeployment struct {
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

// SessionTemplatesProvidersListOutputItemsConfig represents the session templates providers list output items config type.
type SessionTemplatesProvidersListOutputItemsConfig struct {
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

// SessionTemplatesProvidersListOutputItemsAuthConfig represents the session templates providers list output items auth config type.
type SessionTemplatesProvidersListOutputItemsAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionTemplatesProvidersListOutputItems represents the session templates providers list output items type.
type SessionTemplatesProvidersListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session template provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionTemplatesProvidersListOutputItemsToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionTemplateId - Parent session template ID
	SessionTemplateId string                                              `json:"session_template_id"`
	Deployment        SessionTemplatesProvidersListOutputItemsDeployment  `json:"deployment"`
	Config            SessionTemplatesProvidersListOutputItemsConfig      `json:"config"`
	AuthConfig        *SessionTemplatesProvidersListOutputItemsAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionTemplatesProvidersListOutputPagination represents the session templates providers list output pagination type.
type SessionTemplatesProvidersListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// SessionTemplatesProvidersListOutput represents the session templates providers list output type.
type SessionTemplatesProvidersListOutput struct {
	Items      []SessionTemplatesProvidersListOutputItems    `json:"items"`
	Pagination SessionTemplatesProvidersListOutputPagination `json:"pagination"`
}

// MapSessionTemplatesProvidersListOutputFromJSON deserializes JSON data into a SessionTemplatesProvidersListOutput.
func MapSessionTemplatesProvidersListOutputFromJSON(data []byte) (*SessionTemplatesProvidersListOutput, error) {
	var v SessionTemplatesProvidersListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesProvidersListOutputToJSON serializes a SessionTemplatesProvidersListOutput to JSON.
func MapSessionTemplatesProvidersListOutputToJSON(v *SessionTemplatesProvidersListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionTemplatesProvidersListQuery represents the session templates providers list query type.
type SessionTemplatesProvidersListQuery struct {
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

// MapSessionTemplatesProvidersListQueryFromJSON deserializes JSON data into a SessionTemplatesProvidersListQuery.
func MapSessionTemplatesProvidersListQueryFromJSON(data []byte) (*SessionTemplatesProvidersListQuery, error) {
	var v SessionTemplatesProvidersListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesProvidersListQueryToJSON serializes a SessionTemplatesProvidersListQuery to JSON.
func MapSessionTemplatesProvidersListQueryToJSON(v *SessionTemplatesProvidersListQuery) ([]byte, error) {
	return json.Marshal(v)
}
