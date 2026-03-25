package sessiontemplates

import (
	"encoding/json"
	"time"
)

// SessionTemplatesCreateOutputProvidersToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionTemplatesCreateOutputProvidersToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionTemplatesCreateOutputProvidersDeployment represents the session templates create output providers deployment type.
type SessionTemplatesCreateOutputProvidersDeployment struct {
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

// SessionTemplatesCreateOutputProvidersConfig represents the session templates create output providers config type.
type SessionTemplatesCreateOutputProvidersConfig struct {
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

// SessionTemplatesCreateOutputProvidersAuthConfig represents the session templates create output providers auth config type.
type SessionTemplatesCreateOutputProvidersAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionTemplatesCreateOutputProviders represents the session templates create output providers type.
type SessionTemplatesCreateOutputProviders struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session template provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionTemplatesCreateOutputProvidersToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionTemplateId - Parent session template ID
	SessionTemplateId string                                           `json:"session_template_id"`
	Deployment        SessionTemplatesCreateOutputProvidersDeployment  `json:"deployment"`
	Config            SessionTemplatesCreateOutputProvidersConfig      `json:"config"`
	AuthConfig        *SessionTemplatesCreateOutputProvidersAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// SessionTemplatesCreateOutput represents the session templates create output type.
type SessionTemplatesCreateOutput struct {
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
	Providers []SessionTemplatesCreateOutputProviders `json:"providers"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapSessionTemplatesCreateOutputFromJSON deserializes JSON data into a SessionTemplatesCreateOutput.
func MapSessionTemplatesCreateOutputFromJSON(data []byte) (*SessionTemplatesCreateOutput, error) {
	var v SessionTemplatesCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesCreateOutputToJSON serializes a SessionTemplatesCreateOutput to JSON.
func MapSessionTemplatesCreateOutputToJSON(v *SessionTemplatesCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionTemplatesCreateBodyProviders represents the session templates create body providers type.
type SessionTemplatesCreateBodyProviders struct {
	ProviderDeploymentId *string `json:"provider_deployment_id,omitempty"`
	ProviderConfigId     *string `json:"provider_config_id,omitempty"`
	ProviderAuthConfigId *string `json:"provider_auth_config_id,omitempty"`
	ToolFilters          *any    `json:"tool_filters,omitempty"`
}

// SessionTemplatesCreateBody represents the session templates create body type.
type SessionTemplatesCreateBody struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Providers - Optional list of providers to include in the template
	Providers *[]SessionTemplatesCreateBodyProviders `json:"providers,omitempty"`
}

// MapSessionTemplatesCreateBodyFromJSON deserializes JSON data into a SessionTemplatesCreateBody.
func MapSessionTemplatesCreateBodyFromJSON(data []byte) (*SessionTemplatesCreateBody, error) {
	var v SessionTemplatesCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesCreateBodyToJSON serializes a SessionTemplatesCreateBody to JSON.
func MapSessionTemplatesCreateBodyToJSON(v *SessionTemplatesCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
