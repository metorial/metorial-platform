package providers

import (
	"encoding/json"
	"time"
)

// SessionTemplatesProvidersDeleteOutputToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionTemplatesProvidersDeleteOutputToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionTemplatesProvidersDeleteOutputDeployment represents the session templates providers delete output deployment type.
type SessionTemplatesProvidersDeleteOutputDeployment struct {
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

// SessionTemplatesProvidersDeleteOutputConfig represents the session templates providers delete output config type.
type SessionTemplatesProvidersDeleteOutputConfig struct {
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

// SessionTemplatesProvidersDeleteOutputAuthConfig represents the session templates providers delete output auth config type.
type SessionTemplatesProvidersDeleteOutputAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionTemplatesProvidersDeleteOutput represents the session templates providers delete output type.
type SessionTemplatesProvidersDeleteOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session template provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionTemplatesProvidersDeleteOutputToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionTemplateId - Parent session template ID
	SessionTemplateId string                                           `json:"session_template_id"`
	Deployment        SessionTemplatesProvidersDeleteOutputDeployment  `json:"deployment"`
	Config            SessionTemplatesProvidersDeleteOutputConfig      `json:"config"`
	AuthConfig        *SessionTemplatesProvidersDeleteOutputAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapSessionTemplatesProvidersDeleteOutputFromJSON deserializes JSON data into a SessionTemplatesProvidersDeleteOutput.
func MapSessionTemplatesProvidersDeleteOutputFromJSON(data []byte) (*SessionTemplatesProvidersDeleteOutput, error) {
	var v SessionTemplatesProvidersDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesProvidersDeleteOutputToJSON serializes a SessionTemplatesProvidersDeleteOutput to JSON.
func MapSessionTemplatesProvidersDeleteOutputToJSON(v *SessionTemplatesProvidersDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
