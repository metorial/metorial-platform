package providers

import (
	"encoding/json"
	"time"
)

// SessionsProvidersCreateOutputUsage - Usage statistics
type SessionsProvidersCreateOutputUsage struct {
	// TotalProductiveClientMessageCount - Total productive client messages
	TotalProductiveClientMessageCount float64 `json:"total_productive_client_message_count"`
	// TotalProductiveProviderMessageCount - Total productive provider messages
	TotalProductiveProviderMessageCount float64 `json:"total_productive_provider_message_count"`
}

// SessionsProvidersCreateOutputToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionsProvidersCreateOutputToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionsProvidersCreateOutputDeployment represents the sessions providers create output deployment type.
type SessionsProvidersCreateOutputDeployment struct {
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

// SessionsProvidersCreateOutputConfig represents the sessions providers create output config type.
type SessionsProvidersCreateOutputConfig struct {
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

// SessionsProvidersCreateOutputAuthConfig represents the sessions providers create output auth config type.
type SessionsProvidersCreateOutputAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionsProvidersCreateOutput represents the sessions providers create output type.
type SessionsProvidersCreateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// Usage - Usage statistics
	Usage SessionsProvidersCreateOutputUsage `json:"usage"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionsProvidersCreateOutputToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// FromTemplateId - Source template ID
	FromTemplateId *string `json:"from_template_id,omitempty"`
	// FromTemplateProviderId - Source template provider ID
	FromTemplateProviderId *string                                  `json:"from_template_provider_id,omitempty"`
	Deployment             SessionsProvidersCreateOutputDeployment  `json:"deployment"`
	Config                 SessionsProvidersCreateOutputConfig      `json:"config"`
	AuthConfig             *SessionsProvidersCreateOutputAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapSessionsProvidersCreateOutputFromJSON deserializes JSON data into a SessionsProvidersCreateOutput.
func MapSessionsProvidersCreateOutputFromJSON(data []byte) (*SessionsProvidersCreateOutput, error) {
	var v SessionsProvidersCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsProvidersCreateOutputToJSON serializes a SessionsProvidersCreateOutput to JSON.
func MapSessionsProvidersCreateOutputToJSON(v *SessionsProvidersCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionsProvidersCreateBody represents the sessions providers create body type.
type SessionsProvidersCreateBody struct {
	SessionId   string `json:"session_id"`
	ToolFilters *any   `json:"tool_filters,omitempty"`
}

// MapSessionsProvidersCreateBodyFromJSON deserializes JSON data into a SessionsProvidersCreateBody.
func MapSessionsProvidersCreateBodyFromJSON(data []byte) (*SessionsProvidersCreateBody, error) {
	var v SessionsProvidersCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsProvidersCreateBodyToJSON serializes a SessionsProvidersCreateBody to JSON.
func MapSessionsProvidersCreateBodyToJSON(v *SessionsProvidersCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
