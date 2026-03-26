package providers

import (
	"encoding/json"
	"time"
)

// SessionsProvidersDeleteOutputUsage - Usage statistics
type SessionsProvidersDeleteOutputUsage struct {
	// TotalProductiveClientMessageCount - Total productive client messages
	TotalProductiveClientMessageCount float64 `json:"total_productive_client_message_count"`
	// TotalProductiveProviderMessageCount - Total productive provider messages
	TotalProductiveProviderMessageCount float64 `json:"total_productive_provider_message_count"`
}

// SessionsProvidersDeleteOutputToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionsProvidersDeleteOutputToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionsProvidersDeleteOutputDeployment represents the sessions providers delete output deployment type.
type SessionsProvidersDeleteOutputDeployment struct {
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

// SessionsProvidersDeleteOutputConfig represents the sessions providers delete output config type.
type SessionsProvidersDeleteOutputConfig struct {
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

// SessionsProvidersDeleteOutputAuthConfig represents the sessions providers delete output auth config type.
type SessionsProvidersDeleteOutputAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionsProvidersDeleteOutput represents the sessions providers delete output type.
type SessionsProvidersDeleteOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// Usage - Usage statistics
	Usage SessionsProvidersDeleteOutputUsage `json:"usage"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionsProvidersDeleteOutputToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionId - Parent session ID
	SessionId string `json:"session_id"`
	// FromTemplateId - Source template ID
	FromTemplateId *string `json:"from_template_id,omitempty"`
	// FromTemplateProviderId - Source template provider ID
	FromTemplateProviderId *string                                  `json:"from_template_provider_id,omitempty"`
	Deployment             SessionsProvidersDeleteOutputDeployment  `json:"deployment"`
	Config                 SessionsProvidersDeleteOutputConfig      `json:"config"`
	AuthConfig             *SessionsProvidersDeleteOutputAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapSessionsProvidersDeleteOutputFromJSON deserializes JSON data into a SessionsProvidersDeleteOutput.
func MapSessionsProvidersDeleteOutputFromJSON(data []byte) (*SessionsProvidersDeleteOutput, error) {
	var v SessionsProvidersDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionsProvidersDeleteOutputToJSON serializes a SessionsProvidersDeleteOutput to JSON.
func MapSessionsProvidersDeleteOutputToJSON(v *SessionsProvidersDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
