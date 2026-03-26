package sessiontemplates

import (
	"encoding/json"
	"time"
)

// SessionTemplatesListOutputItemsProvidersToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionTemplatesListOutputItemsProvidersToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionTemplatesListOutputItemsProvidersDeployment represents the session templates list output items providers deployment type.
type SessionTemplatesListOutputItemsProvidersDeployment struct {
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

// SessionTemplatesListOutputItemsProvidersConfig represents the session templates list output items providers config type.
type SessionTemplatesListOutputItemsProvidersConfig struct {
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

// SessionTemplatesListOutputItemsProvidersAuthConfig represents the session templates list output items providers auth config type.
type SessionTemplatesListOutputItemsProvidersAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionTemplatesListOutputItemsProviders represents the session templates list output items providers type.
type SessionTemplatesListOutputItemsProviders struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session template provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionTemplatesListOutputItemsProvidersToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionTemplateId - Parent session template ID
	SessionTemplateId string                                              `json:"session_template_id"`
	Deployment        SessionTemplatesListOutputItemsProvidersDeployment  `json:"deployment"`
	Config            SessionTemplatesListOutputItemsProvidersConfig      `json:"config"`
	AuthConfig        *SessionTemplatesListOutputItemsProvidersAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionTemplatesListOutputItems represents the session templates list output items type.
type SessionTemplatesListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session template identifier
	Id string `json:"id"`
	// Name - Template name
	Name string `json:"name"`
	// Description - Template description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Providers - Template providers
	Providers []SessionTemplatesListOutputItemsProviders `json:"providers"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionTemplatesListOutputPagination represents the session templates list output pagination type.
type SessionTemplatesListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// SessionTemplatesListOutput represents the session templates list output type.
type SessionTemplatesListOutput struct {
	Items      []SessionTemplatesListOutputItems    `json:"items"`
	Pagination SessionTemplatesListOutputPagination `json:"pagination"`
}

// MapSessionTemplatesListOutputFromJSON deserializes JSON data into a SessionTemplatesListOutput.
func MapSessionTemplatesListOutputFromJSON(data []byte) (*SessionTemplatesListOutput, error) {
	var v SessionTemplatesListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesListOutputToJSON serializes a SessionTemplatesListOutput to JSON.
func MapSessionTemplatesListOutputToJSON(v *SessionTemplatesListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionTemplatesListQuery represents the session templates list query type.
type SessionTemplatesListQuery struct {
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

// MapSessionTemplatesListQueryFromJSON deserializes JSON data into a SessionTemplatesListQuery.
func MapSessionTemplatesListQueryFromJSON(data []byte) (*SessionTemplatesListQuery, error) {
	var v SessionTemplatesListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesListQueryToJSON serializes a SessionTemplatesListQuery to JSON.
func MapSessionTemplatesListQueryToJSON(v *SessionTemplatesListQuery) ([]byte, error) {
	return json.Marshal(v)
}
