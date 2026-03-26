package providers

import (
	"encoding/json"
	"time"
)

// SessionTemplatesProvidersCreateOutputToolFilter represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type SessionTemplatesProvidersCreateOutputToolFilter struct {
	Type    *string `json:"type,omitempty"`
	Filters *[]any  `json:"filters,omitempty"`
}

// SessionTemplatesProvidersCreateOutputDeployment represents the session templates providers create output deployment type.
type SessionTemplatesProvidersCreateOutputDeployment struct {
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

// SessionTemplatesProvidersCreateOutputConfig represents the session templates providers create output config type.
type SessionTemplatesProvidersCreateOutputConfig struct {
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

// SessionTemplatesProvidersCreateOutputAuthConfig represents the session templates providers create output auth config type.
type SessionTemplatesProvidersCreateOutputAuthConfig struct {
	Object string `json:"object"`
	Id     string `json:"id"`
}

// SessionTemplatesProvidersCreateOutput represents the session templates providers create output type.
type SessionTemplatesProvidersCreateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique session template provider identifier
	Id string `json:"id"`
	// Status - Provider status
	Status string `json:"status"`
	// ToolFilter - Tool filter configuration
	ToolFilter SessionTemplatesProvidersCreateOutputToolFilter `json:"tool_filter"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// SessionTemplateId - Parent session template ID
	SessionTemplateId string                                           `json:"session_template_id"`
	Deployment        SessionTemplatesProvidersCreateOutputDeployment  `json:"deployment"`
	Config            SessionTemplatesProvidersCreateOutputConfig      `json:"config"`
	AuthConfig        *SessionTemplatesProvidersCreateOutputAuthConfig `json:"auth_config,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapSessionTemplatesProvidersCreateOutputFromJSON deserializes JSON data into a SessionTemplatesProvidersCreateOutput.
func MapSessionTemplatesProvidersCreateOutputFromJSON(data []byte) (*SessionTemplatesProvidersCreateOutput, error) {
	var v SessionTemplatesProvidersCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesProvidersCreateOutputToJSON serializes a SessionTemplatesProvidersCreateOutput to JSON.
func MapSessionTemplatesProvidersCreateOutputToJSON(v *SessionTemplatesProvidersCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// SessionTemplatesProvidersCreateBody represents the session templates providers create body type.
type SessionTemplatesProvidersCreateBody struct {
	SessionTemplateId     string  `json:"session_template_id"`
	ProviderDeploymentId  *string `json:"provider_deployment_id,omitempty"`
	ProviderConfigId      *string `json:"provider_config_id,omitempty"`
	ProviderConfigVaultId *string `json:"provider_config_vault_id,omitempty"`
	ProviderAuthConfigId  *string `json:"provider_auth_config_id,omitempty"`
	ToolFilters           *any    `json:"tool_filters,omitempty"`
}

// MapSessionTemplatesProvidersCreateBodyFromJSON deserializes JSON data into a SessionTemplatesProvidersCreateBody.
func MapSessionTemplatesProvidersCreateBodyFromJSON(data []byte) (*SessionTemplatesProvidersCreateBody, error) {
	var v SessionTemplatesProvidersCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapSessionTemplatesProvidersCreateBodyToJSON serializes a SessionTemplatesProvidersCreateBody to JSON.
func MapSessionTemplatesProvidersCreateBodyToJSON(v *SessionTemplatesProvidersCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
