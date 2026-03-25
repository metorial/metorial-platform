package sessiontemplates

import (
	"encoding/json"
	"time"
)

// SessionTemplatesUpdateOutputProvidersToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionTemplatesUpdateOutputProvidersToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionTemplatesUpdateOutputProvidersDeployment represents the session templates update output providers deployment type.
type SessionTemplatesUpdateOutputProvidersDeployment struct {
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

// SessionTemplatesUpdateOutputProvidersConfig represents the session templates update output providers config type.
type SessionTemplatesUpdateOutputProvidersConfig struct {
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

// SessionTemplatesUpdateOutputProvidersAuthConfig represents the session templates update output providers auth config type.
type SessionTemplatesUpdateOutputProvidersAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionTemplatesUpdateOutputProviders represents the session templates update output providers type.
type SessionTemplatesUpdateOutputProviders struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session template provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionTemplatesUpdateOutputProvidersToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionTemplateId - Parent session template ID
	SessionTemplateId string                                           `json:"session_template_id"`
	Deployment        SessionTemplatesUpdateOutputProvidersDeployment  `json:"deployment"`
	Config            SessionTemplatesUpdateOutputProvidersConfig      `json:"config"`
	AuthConfig        *SessionTemplatesUpdateOutputProvidersAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionTemplatesUpdateOutput represents the session templates update output type.
type SessionTemplatesUpdateOutput struct {
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
	Providers []SessionTemplatesUpdateOutputProviders `json:"providers"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapSessionTemplatesUpdateOutputFromJSON deserializes JSON data into a SessionTemplatesUpdateOutput.
func MapSessionTemplatesUpdateOutputFromJSON(data []byte) (*SessionTemplatesUpdateOutput, error) {
	var v SessionTemplatesUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesUpdateOutputToJSON serializes a SessionTemplatesUpdateOutput to JSON.
func MapSessionTemplatesUpdateOutputToJSON(v *SessionTemplatesUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionTemplatesUpdateBody represents the session templates update body type.
type SessionTemplatesUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// MapSessionTemplatesUpdateBodyFromJSON deserializes JSON data into a SessionTemplatesUpdateBody.
func MapSessionTemplatesUpdateBodyFromJSON(data []byte) (*SessionTemplatesUpdateBody, error) {
	var v SessionTemplatesUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesUpdateBodyToJSON serializes a SessionTemplatesUpdateBody to JSON.
func MapSessionTemplatesUpdateBodyToJSON(v *SessionTemplatesUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
