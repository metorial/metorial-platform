package sessions

import (
	"encoding/json"
	"time"
)

// SessionsGetOutputUsage represents the sessions get output usage type.
type SessionsGetOutputUsage struct {
	// TotalProductiveClientMessageCount - Total productive client messages
	TotalProductiveClientMessageCount float64 `json:"total_productive_client_message_count"`
	// TotalProductiveProviderMessageCount - Total productive provider messages
	TotalProductiveProviderMessageCount float64 `json:"total_productive_provider_message_count"`
}

// SessionsGetOutputProvidersUsage - Usage statistics
type SessionsGetOutputProvidersUsage struct {
	// TotalProductiveClientMessageCount - Total productive client messages
	TotalProductiveClientMessageCount float64 `json:"total_productive_client_message_count"`
	// TotalProductiveProviderMessageCount - Total productive provider messages
	TotalProductiveProviderMessageCount float64 `json:"total_productive_provider_message_count"`
}

// SessionsGetOutputProvidersToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionsGetOutputProvidersToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionsGetOutputProvidersDeployment represents the sessions get output providers deployment type.
type SessionsGetOutputProvidersDeployment struct {
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

// SessionsGetOutputProvidersConfig represents the sessions get output providers config type.
type SessionsGetOutputProvidersConfig struct {
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

// SessionsGetOutputProvidersAuthConfig represents the sessions get output providers auth config type.
type SessionsGetOutputProvidersAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionsGetOutputProviders represents the sessions get output providers type.
type SessionsGetOutputProviders struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// Usage - Usage statistics
	Usage SessionsGetOutputProvidersUsage `json:"usage"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionsGetOutputProvidersToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// FromTemplateId - Source template ID
	FromTemplateId *string `json:"from_template_id,omitempty"`
	// FromTemplateProviderId - Source template provider ID
	FromTemplateProviderId *string                               `json:"from_template_provider_id,omitempty"`
	Deployment             SessionsGetOutputProvidersDeployment  `json:"deployment"`
	Config                 SessionsGetOutputProvidersConfig      `json:"config"`
	AuthConfig             *SessionsGetOutputProvidersAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionsGetOutput represents the sessions get output type.
type SessionsGetOutput struct {
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
	ClientSecret *string                `json:"client_secret,omitempty"`
	Usage        SessionsGetOutputUsage `json:"usage"`
	// Providers - Session providers
	Providers []SessionsGetOutputProviders `json:"providers"`
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

// MapSessionsGetOutputFromJSON deserializes JSON data into a SessionsGetOutput.
func MapSessionsGetOutputFromJSON(data []byte) (*SessionsGetOutput, error) {
	var v SessionsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsGetOutputToJSON serializes a SessionsGetOutput to JSON.
func MapSessionsGetOutputToJSON(v *SessionsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
