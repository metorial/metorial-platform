package customproviders

import (
	"encoding/json"
	"time"
)

// CustomProvidersGetOutputDraftContainerImage represents the custom providers get output draft container image type.
type CustomProvidersGetOutputDraftContainerImage struct {
	// Object - String representing the container image draft type
	Object string `json:"object"`
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersGetOutputDraftRemoteMcpServer represents the custom providers get output draft remote mcp server type.
type CustomProvidersGetOutputDraftRemoteMcpServer struct {
	// Object - String representing the remote MCP server draft type
	Object string `json:"object"`
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for connecting to the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersGetOutputDraftConfigSchema represents the custom providers get output draft config schema type.
type CustomProvidersGetOutputDraftConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersGetOutputDraftConfig represents the custom providers get output draft config type.
type CustomProvidersGetOutputDraftConfig struct {
	// Object - String representing the custom provider config draft type
	Object string                                    `json:"object"`
	Schema CustomProvidersGetOutputDraftConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersGetOutputDraft represents the custom providers get output draft type.
type CustomProvidersGetOutputDraft struct {
	// Object - String representing the draft's type
	Object          string                                        `json:"object"`
	ContainerImage  *CustomProvidersGetOutputDraftContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersGetOutputDraftRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	Config          CustomProvidersGetOutputDraftConfig           `json:"config"`
}

// CustomProvidersGetOutputScmRepoProvider represents the custom providers get output scm repo provider type.
type CustomProvidersGetOutputScmRepoProvider struct {
	Object string `json:"object"`
	// Type - SCM provider type
	Type string `json:"type"`
	// Id - External provider identifier
	Id string `json:"id"`
	// Name - Repository name on the provider
	Name string `json:"name"`
	// Owner - Repository owner on the provider
	Owner string `json:"owner"`
}

// CustomProvidersGetOutputScmRepo represents the custom providers get output scm repo type.
type CustomProvidersGetOutputScmRepo struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                  `json:"id"`
	Provider CustomProvidersGetOutputScmRepoProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersGetOutputProviderPublisher represents the custom providers get output provider publisher type.
type CustomProvidersGetOutputProviderPublisher struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique publisher identifier
	Id string `json:"id"`
	// Name - Display name of the publisher
	Name string `json:"name"`
	// Description - Brief description of the publisher
	Description *string `json:"description,omitempty"`
	// ImageUrl - URL of the publisher logo
	ImageUrl string `json:"image_url"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersGetOutputProviderCurrentVersion represents the custom providers get output provider current version type.
type CustomProvidersGetOutputProviderCurrentVersion struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique version identifier
	Id string `json:"id"`
	// Version - Version identifier string
	Version string `json:"version"`
	// ProviderId - Provider ID
	ProviderId string `json:"provider_id"`
	// IsCurrent - Whether this is the current version
	IsCurrent bool `json:"is_current"`
	// Name - Version name
	Name string `json:"name"`
	// Description - Version description
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// SpecificationId - Specification ID
	SpecificationId *string `json:"specification_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersGetOutputProviderOauthAutoRegistration represents the custom providers get output provider oauth auto registration type.
type CustomProvidersGetOutputProviderOauthAutoRegistration struct {
	// Status - Auto-registration status
	Status string `json:"status"`
}

// CustomProvidersGetOutputProviderOauth represents the custom providers get output provider oauth type.
type CustomProvidersGetOutputProviderOauth struct {
	// Status - OAuth status
	Status string `json:"status"`
	// CallbackUrl - OAuth callback URL
	CallbackUrl      *string                                               `json:"callback_url,omitempty"`
	AutoRegistration CustomProvidersGetOutputProviderOauthAutoRegistration `json:"auto_registration"`
}

// CustomProvidersGetOutputProvider represents the custom providers get output provider type.
type CustomProvidersGetOutputProvider struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider identifier
	Id string `json:"id"`
	// Access - Access level of the provider
	Access string `json:"access"`
	// Status - Current status of the provider
	Status         string                                          `json:"status"`
	Publisher      CustomProvidersGetOutputProviderPublisher       `json:"publisher"`
	CurrentVersion *CustomProvidersGetOutputProviderCurrentVersion `json:"current_version,omitempty"`
	Oauth          *CustomProvidersGetOutputProviderOauth          `json:"oauth,omitempty"`
	// Identifier - Provider identifier
	Identifier string `json:"identifier"`
	// Name - Display name of the provider
	Name string `json:"name"`
	// Description - Brief description of the provider
	Description *string `json:"description,omitempty"`
	// Slug - URL-friendly identifier
	Slug string `json:"slug"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersGetOutput represents the custom providers get output type.
type CustomProvidersGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider identifier
	Id string `json:"id"`
	// Status - Current status of the custom provider
	Status string `json:"status"`
	// Type - Type of the custom provider
	Type string `json:"type"`
	// Name - Display name of the custom provider
	Name string `json:"name"`
	// Description - Brief description of the custom provider
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any                   `json:"metadata,omitempty"`
	Draft    CustomProvidersGetOutputDraft     `json:"draft"`
	ScmRepo  *CustomProvidersGetOutputScmRepo  `json:"scm_repo,omitempty"`
	Provider *CustomProvidersGetOutputProvider `json:"provider,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCustomProvidersGetOutputFromJSON deserializes JSON data into a CustomProvidersGetOutput.
func MapCustomProvidersGetOutputFromJSON(data []byte) (*CustomProvidersGetOutput, error) {
	var v CustomProvidersGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersGetOutputToJSON serializes a CustomProvidersGetOutput to JSON.
func MapCustomProvidersGetOutputToJSON(v *CustomProvidersGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
