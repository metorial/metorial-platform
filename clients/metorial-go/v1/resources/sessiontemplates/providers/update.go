package providers

import (
	"encoding/json"
	"time"
)

// SessionTemplatesProvidersUpdateOutputToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionTemplatesProvidersUpdateOutputToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionTemplatesProvidersUpdateOutputDeployment represents the session templates providers update output deployment type.
type SessionTemplatesProvidersUpdateOutputDeployment struct {
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

// SessionTemplatesProvidersUpdateOutputConfig represents the session templates providers update output config type.
type SessionTemplatesProvidersUpdateOutputConfig struct {
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

// SessionTemplatesProvidersUpdateOutputAuthConfig represents the session templates providers update output auth config type.
type SessionTemplatesProvidersUpdateOutputAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionTemplatesProvidersUpdateOutput represents the session templates providers update output type.
type SessionTemplatesProvidersUpdateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session template provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionTemplatesProvidersUpdateOutputToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionTemplateId - Parent session template ID
	SessionTemplateId string                                           `json:"session_template_id"`
	Deployment        SessionTemplatesProvidersUpdateOutputDeployment  `json:"deployment"`
	Config            SessionTemplatesProvidersUpdateOutputConfig      `json:"config"`
	AuthConfig        *SessionTemplatesProvidersUpdateOutputAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapSessionTemplatesProvidersUpdateOutputFromJSON deserializes JSON data into a SessionTemplatesProvidersUpdateOutput.
func MapSessionTemplatesProvidersUpdateOutputFromJSON(data []byte) (*SessionTemplatesProvidersUpdateOutput, error) {
	var v SessionTemplatesProvidersUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesProvidersUpdateOutputToJSON serializes a SessionTemplatesProvidersUpdateOutput to JSON.
func MapSessionTemplatesProvidersUpdateOutputToJSON(v *SessionTemplatesProvidersUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionTemplatesProvidersUpdateBody represents the session templates providers update body type.
type SessionTemplatesProvidersUpdateBody struct {
	ToolFilters *any `json:"tool_filters,omitempty"`
}

// MapSessionTemplatesProvidersUpdateBodyFromJSON deserializes JSON data into a SessionTemplatesProvidersUpdateBody.
func MapSessionTemplatesProvidersUpdateBodyFromJSON(data []byte) (*SessionTemplatesProvidersUpdateBody, error) {
	var v SessionTemplatesProvidersUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesProvidersUpdateBodyToJSON serializes a SessionTemplatesProvidersUpdateBody to JSON.
func MapSessionTemplatesProvidersUpdateBodyToJSON(v *SessionTemplatesProvidersUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
