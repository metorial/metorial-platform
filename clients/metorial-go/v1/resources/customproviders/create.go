package customproviders

import (
	"encoding/json"
	"time"
)

// CustomProvidersCreateOutputDraftContainerImage represents the custom providers create output draft container image type.
type CustomProvidersCreateOutputDraftContainerImage struct {
	// Object - String representing the container image draft type
	Object string `json:"object"`
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersCreateOutputDraftRemoteMcpServer represents the custom providers create output draft remote mcp server type.
type CustomProvidersCreateOutputDraftRemoteMcpServer struct {
	// Object - String representing the remote MCP server draft type
	Object string `json:"object"`
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for connecting to the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersCreateOutputDraftConfigSchema represents the custom providers create output draft config schema type.
type CustomProvidersCreateOutputDraftConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersCreateOutputDraftConfig represents the custom providers create output draft config type.
type CustomProvidersCreateOutputDraftConfig struct {
	// Object - String representing the custom provider config draft type
	Object string                                       `json:"object"`
	Schema CustomProvidersCreateOutputDraftConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersCreateOutputDraft represents the custom providers create output draft type.
type CustomProvidersCreateOutputDraft struct {
	// Object - String representing the draft's type
	Object          string                                           `json:"object"`
	ContainerImage  *CustomProvidersCreateOutputDraftContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersCreateOutputDraftRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	Config          CustomProvidersCreateOutputDraftConfig           `json:"config"`
}

// CustomProvidersCreateOutputScmRepoProvider represents the custom providers create output scm repo provider type.
type CustomProvidersCreateOutputScmRepoProvider struct {
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

// CustomProvidersCreateOutputScmRepo represents the custom providers create output scm repo type.
type CustomProvidersCreateOutputScmRepo struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                     `json:"id"`
	Provider CustomProvidersCreateOutputScmRepoProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCreateOutputProviderPublisher represents the custom providers create output provider publisher type.
type CustomProvidersCreateOutputProviderPublisher struct {
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

// CustomProvidersCreateOutputProviderCurrentVersion represents the custom providers create output provider current version type.
type CustomProvidersCreateOutputProviderCurrentVersion struct {
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

// CustomProvidersCreateOutputProviderOauthAutoRegistration represents the custom providers create output provider oauth auto registration type.
type CustomProvidersCreateOutputProviderOauthAutoRegistration struct {
	// Status - Auto-registration status
	Status string `json:"status"`
}

// CustomProvidersCreateOutputProviderOauth represents the custom providers create output provider oauth type.
type CustomProvidersCreateOutputProviderOauth struct {
	// Status - OAuth status
	Status string `json:"status"`
	// CallbackUrl - OAuth callback URL
	CallbackUrl      *string                                                  `json:"callback_url,omitempty"`
	AutoRegistration CustomProvidersCreateOutputProviderOauthAutoRegistration `json:"auto_registration"`
}

// CustomProvidersCreateOutputProvider represents the custom providers create output provider type.
type CustomProvidersCreateOutputProvider struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider identifier
	Id string `json:"id"`
	// Access - Access level of the provider
	Access string `json:"access"`
	// Status - Current status of the provider
	Status         string                                             `json:"status"`
	Publisher      CustomProvidersCreateOutputProviderPublisher       `json:"publisher"`
	CurrentVersion *CustomProvidersCreateOutputProviderCurrentVersion `json:"current_version,omitempty"`
	Oauth          *CustomProvidersCreateOutputProviderOauth          `json:"oauth,omitempty"`
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

// CustomProvidersCreateOutput represents the custom providers create output type.
type CustomProvidersCreateOutput struct {
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
	Draft    CustomProvidersCreateOutputDraft     `json:"draft"`
	ScmRepo  *CustomProvidersCreateOutputScmRepo  `json:"scm_repo,omitempty"`
	Provider *CustomProvidersCreateOutputProvider `json:"provider,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCustomProvidersCreateOutputFromJSON deserializes JSON data into a CustomProvidersCreateOutput.
func MapCustomProvidersCreateOutputFromJSON(data []byte) (*CustomProvidersCreateOutput, error) {
	var v CustomProvidersCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersCreateOutputToJSON serializes a CustomProvidersCreateOutput to JSON.
func MapCustomProvidersCreateOutputToJSON(v *CustomProvidersCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CustomProvidersCreateBodyFromFiles represents the custom providers create body from files type.
type CustomProvidersCreateBodyFromFiles struct {
	// Filename - File name
	Filename string `json:"filename"`
	// Content - File content
	Content string `json:"content"`
	// Encoding - Content encoding
	Encoding *string `json:"encoding,omitempty"`
}

// CustomProvidersCreateBodyFromRuntime represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type CustomProvidersCreateBodyFromRuntime struct {
	Identifier *string `json:"identifier,omitempty"`
	// Version - Python version
	Version *string `json:"version,omitempty"`
}

// CustomProvidersCreateBodyFromRepository represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type CustomProvidersCreateBodyFromRepository struct {
	// RepositoryId - Repository ID
	RepositoryId *string `json:"repository_id,omitempty"`
	// Branch - Branch name
	Branch *string `json:"branch,omitempty"`
	// Path - Repository path
	Path *string `json:"path,omitempty"`
	Type *string `json:"type,omitempty"`
	// RepositoryUrl - Git repository URL
	RepositoryUrl *string `json:"repository_url,omitempty"`
}

// CustomProvidersCreateBodyFrom represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type CustomProvidersCreateBodyFrom struct {
	Type *string `json:"type,omitempty"`
	// ImageRef - Container image reference
	ImageRef *string `json:"image_ref,omitempty"`
	// Username - Registry username
	Username *string `json:"username,omitempty"`
	// Password - Registry password
	Password *string `json:"password,omitempty"`
	// RemoteUrl - Remote MCP server URL
	RemoteUrl *string `json:"remote_url,omitempty"`
	// OauthConfig - Remote server configuration
	OauthConfig *map[string]any `json:"oauth_config,omitempty"`
	// Protocol - MCP protocol to use
	Protocol *string `json:"protocol,omitempty"`
	// Files - Source files
	Files *[]CustomProvidersCreateBodyFromFiles `json:"files,omitempty"`
	// Env - Environment variables
	Env        *map[string]string                       `json:"env,omitempty"`
	Runtime    *CustomProvidersCreateBodyFromRuntime    `json:"runtime,omitempty"`
	Repository *CustomProvidersCreateBodyFromRepository `json:"repository,omitempty"`
}

// CustomProvidersCreateBodyConfig represents the custom providers create body config type.
type CustomProvidersCreateBodyConfig struct {
	// Schema - Configuration JSON schema
	Schema map[string]any `json:"schema"`
	// Transformer - Configuration transformer code
	Transformer string `json:"transformer"`
}

// CustomProvidersCreateBody represents the custom providers create body type.
type CustomProvidersCreateBody struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	// Metadata - Custom key-value pairs for storing additional information
	Metadata *map[string]any                  `json:"metadata,omitempty"`
	From     CustomProvidersCreateBodyFrom    `json:"from"`
	Config   *CustomProvidersCreateBodyConfig `json:"config,omitempty"`
}

// MapCustomProvidersCreateBodyFromJSON deserializes JSON data into a CustomProvidersCreateBody.
func MapCustomProvidersCreateBodyFromJSON(data []byte) (*CustomProvidersCreateBody, error) {
	var v CustomProvidersCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersCreateBodyToJSON serializes a CustomProvidersCreateBody to JSON.
func MapCustomProvidersCreateBodyToJSON(v *CustomProvidersCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
