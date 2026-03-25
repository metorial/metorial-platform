package customproviders

import (
	"encoding/json"
	"time"
)

// CustomProvidersUpdateOutputDraftContainerImage represents the custom providers update output draft container image type.
type CustomProvidersUpdateOutputDraftContainerImage struct {
	// Object - String representing the container image draft type
	Object string `json:"object"`
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersUpdateOutputDraftRemoteMcpServer represents the custom providers update output draft remote mcp server type.
type CustomProvidersUpdateOutputDraftRemoteMcpServer struct {
	// Object - String representing the remote MCP server draft type
	Object string `json:"object"`
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for connecting to the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersUpdateOutputDraftConfigSchema represents the custom providers update output draft config schema type.
type CustomProvidersUpdateOutputDraftConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersUpdateOutputDraftConfig represents the custom providers update output draft config type.
type CustomProvidersUpdateOutputDraftConfig struct {
	// Object - String representing the custom provider config draft type
	Object string                                       `json:"object"`
	Schema CustomProvidersUpdateOutputDraftConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersUpdateOutputDraft represents the custom providers update output draft type.
type CustomProvidersUpdateOutputDraft struct {
	// Object - String representing the draft's type
	Object          string                                           `json:"object"`
	ContainerImage  *CustomProvidersUpdateOutputDraftContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersUpdateOutputDraftRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	Config          CustomProvidersUpdateOutputDraftConfig           `json:"config"`
}

// CustomProvidersUpdateOutputScmRepoProvider represents the custom providers update output scm repo provider type.
type CustomProvidersUpdateOutputScmRepoProvider struct {
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

// CustomProvidersUpdateOutputScmRepo represents the custom providers update output scm repo type.
type CustomProvidersUpdateOutputScmRepo struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                     `json:"id"`
	Provider CustomProvidersUpdateOutputScmRepoProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersUpdateOutputProviderPublisher represents the custom providers update output provider publisher type.
type CustomProvidersUpdateOutputProviderPublisher struct {
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

// CustomProvidersUpdateOutputProviderCurrentVersion represents the custom providers update output provider current version type.
type CustomProvidersUpdateOutputProviderCurrentVersion struct {
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

// CustomProvidersUpdateOutputProviderOauthAutoRegistration represents the custom providers update output provider oauth auto registration type.
type CustomProvidersUpdateOutputProviderOauthAutoRegistration struct {
	// Status - Auto-registration status
	Status string `json:"status"`
}

// CustomProvidersUpdateOutputProviderOauth represents the custom providers update output provider oauth type.
type CustomProvidersUpdateOutputProviderOauth struct {
	// Status - OAuth status
	Status string `json:"status"`
	// CallbackUrl - OAuth callback URL
	CallbackUrl      *string                                                  `json:"callback_url,omitempty"`
	AutoRegistration CustomProvidersUpdateOutputProviderOauthAutoRegistration `json:"auto_registration"`
}

// CustomProvidersUpdateOutputProvider represents the custom providers update output provider type.
type CustomProvidersUpdateOutputProvider struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider identifier
	Id string `json:"id"`
	// Access - Access level of the provider
	Access string `json:"access"`
	// Status - Current status of the provider
	Status         string                                             `json:"status"`
	Publisher      CustomProvidersUpdateOutputProviderPublisher       `json:"publisher"`
	CurrentVersion *CustomProvidersUpdateOutputProviderCurrentVersion `json:"current_version,omitempty"`
	Oauth          *CustomProvidersUpdateOutputProviderOauth          `json:"oauth,omitempty"`
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

// CustomProvidersUpdateOutput represents the custom providers update output type.
type CustomProvidersUpdateOutput struct {
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
	Metadata *map[string]any                      `json:"metadata,omitempty"`
	Draft    CustomProvidersUpdateOutputDraft     `json:"draft"`
	ScmRepo  *CustomProvidersUpdateOutputScmRepo  `json:"scm_repo,omitempty"`
	Provider *CustomProvidersUpdateOutputProvider `json:"provider,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCustomProvidersUpdateOutputFromJSON deserializes JSON data into a CustomProvidersUpdateOutput.
func MapCustomProvidersUpdateOutputFromJSON(data []byte) (*CustomProvidersUpdateOutput, error) {
	var v CustomProvidersUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersUpdateOutputToJSON serializes a CustomProvidersUpdateOutput to JSON.
func MapCustomProvidersUpdateOutputToJSON(v *CustomProvidersUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CustomProvidersUpdateBody represents the custom providers update body type.
type CustomProvidersUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Readme - README content in markdown format
	Readme *string `json:"readme,omitempty"`
}

// MapCustomProvidersUpdateBodyFromJSON deserializes JSON data into a CustomProvidersUpdateBody.
func MapCustomProvidersUpdateBodyFromJSON(data []byte) (*CustomProvidersUpdateBody, error) {
	var v CustomProvidersUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersUpdateBodyToJSON serializes a CustomProvidersUpdateBody to JSON.
func MapCustomProvidersUpdateBodyToJSON(v *CustomProvidersUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
