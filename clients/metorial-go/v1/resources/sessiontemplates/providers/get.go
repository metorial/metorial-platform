package providers

import (
	"encoding/json"
	"time"
)

// SessionTemplatesProvidersGetOutputToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionTemplatesProvidersGetOutputToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionTemplatesProvidersGetOutputDeployment represents the session templates providers get output deployment type.
type SessionTemplatesProvidersGetOutputDeployment struct {
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

// SessionTemplatesProvidersGetOutputConfig represents the session templates providers get output config type.
type SessionTemplatesProvidersGetOutputConfig struct {
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

// SessionTemplatesProvidersGetOutputAuthConfig represents the session templates providers get output auth config type.
type SessionTemplatesProvidersGetOutputAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionTemplatesProvidersGetOutput represents the session templates providers get output type.
type SessionTemplatesProvidersGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session template provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionTemplatesProvidersGetOutputToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionTemplateId - Parent session template ID
	SessionTemplateId string                                        `json:"session_template_id"`
	Deployment        SessionTemplatesProvidersGetOutputDeployment  `json:"deployment"`
	Config            SessionTemplatesProvidersGetOutputConfig      `json:"config"`
	AuthConfig        *SessionTemplatesProvidersGetOutputAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapSessionTemplatesProvidersGetOutputFromJSON deserializes JSON data into a SessionTemplatesProvidersGetOutput.
func MapSessionTemplatesProvidersGetOutputFromJSON(data []byte) (*SessionTemplatesProvidersGetOutput, error) {
	var v SessionTemplatesProvidersGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesProvidersGetOutputToJSON serializes a SessionTemplatesProvidersGetOutput to JSON.
func MapSessionTemplatesProvidersGetOutputToJSON(v *SessionTemplatesProvidersGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
