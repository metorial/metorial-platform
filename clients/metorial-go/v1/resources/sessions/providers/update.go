package providers

import (
	"encoding/json"
	"time"
)

// SessionsProvidersUpdateOutputUsage - Usage statistics
type SessionsProvidersUpdateOutputUsage struct {
	// TotalProductiveClientMessageCount - Total productive client messages
	TotalProductiveClientMessageCount float64 `json:"total_productive_client_message_count"`
	// TotalProductiveProviderMessageCount - Total productive provider messages
	TotalProductiveProviderMessageCount float64 `json:"total_productive_provider_message_count"`
}

// SessionsProvidersUpdateOutputToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionsProvidersUpdateOutputToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionsProvidersUpdateOutputDeployment represents the sessions providers update output deployment type.
type SessionsProvidersUpdateOutputDeployment struct {
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

// SessionsProvidersUpdateOutputConfig represents the sessions providers update output config type.
type SessionsProvidersUpdateOutputConfig struct {
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

// SessionsProvidersUpdateOutputAuthConfig represents the sessions providers update output auth config type.
type SessionsProvidersUpdateOutputAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionsProvidersUpdateOutput represents the sessions providers update output type.
type SessionsProvidersUpdateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// Usage - Usage statistics
	Usage SessionsProvidersUpdateOutputUsage `json:"usage"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionsProvidersUpdateOutputToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// FromTemplateId - Source template ID
	FromTemplateId *string `json:"from_template_id,omitempty"`
	// FromTemplateProviderId - Source template provider ID
	FromTemplateProviderId *string                                  `json:"from_template_provider_id,omitempty"`
	Deployment             SessionsProvidersUpdateOutputDeployment  `json:"deployment"`
	Config                 SessionsProvidersUpdateOutputConfig      `json:"config"`
	AuthConfig             *SessionsProvidersUpdateOutputAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapSessionsProvidersUpdateOutputFromJSON deserializes JSON data into a SessionsProvidersUpdateOutput.
func MapSessionsProvidersUpdateOutputFromJSON(data []byte) (*SessionsProvidersUpdateOutput, error) {
	var v SessionsProvidersUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsProvidersUpdateOutputToJSON serializes a SessionsProvidersUpdateOutput to JSON.
func MapSessionsProvidersUpdateOutputToJSON(v *SessionsProvidersUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionsProvidersUpdateBody represents the sessions providers update body type.
type SessionsProvidersUpdateBody struct {
	ToolFilters *any `json:"tool_filters,omitempty"`
}

// MapSessionsProvidersUpdateBodyFromJSON deserializes JSON data into a SessionsProvidersUpdateBody.
func MapSessionsProvidersUpdateBodyFromJSON(data []byte) (*SessionsProvidersUpdateBody, error) {
	var v SessionsProvidersUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsProvidersUpdateBodyToJSON serializes a SessionsProvidersUpdateBody to JSON.
func MapSessionsProvidersUpdateBodyToJSON(v *SessionsProvidersUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
