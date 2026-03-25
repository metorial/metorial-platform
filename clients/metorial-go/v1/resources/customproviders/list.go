package customproviders

import (
	"encoding/json"
	"time"
)

// CustomProvidersListOutputItemsDraftContainerImage represents the custom providers list output items draft container image type.
type CustomProvidersListOutputItemsDraftContainerImage struct {
	// Object - String representing the container image draft type
	Object string `json:"object"`
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersListOutputItemsDraftRemoteMcpServer represents the custom providers list output items draft remote mcp server type.
type CustomProvidersListOutputItemsDraftRemoteMcpServer struct {
	// Object - String representing the remote MCP server draft type
	Object string `json:"object"`
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for connecting to the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersListOutputItemsDraftConfigSchema represents the custom providers list output items draft config schema type.
type CustomProvidersListOutputItemsDraftConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersListOutputItemsDraftConfig represents the custom providers list output items draft config type.
type CustomProvidersListOutputItemsDraftConfig struct {
	// Object - String representing the custom provider config draft type
	Object string                                          `json:"object"`
	Schema CustomProvidersListOutputItemsDraftConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersListOutputItemsDraft represents the custom providers list output items draft type.
type CustomProvidersListOutputItemsDraft struct {
	// Object - String representing the draft's type
	Object          string                                              `json:"object"`
	ContainerImage  *CustomProvidersListOutputItemsDraftContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersListOutputItemsDraftRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	Config          CustomProvidersListOutputItemsDraftConfig           `json:"config"`
}

// CustomProvidersListOutputItemsScmRepoProvider represents the custom providers list output items scm repo provider type.
type CustomProvidersListOutputItemsScmRepoProvider struct {
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

// CustomProvidersListOutputItemsScmRepo represents the custom providers list output items scm repo type.
type CustomProvidersListOutputItemsScmRepo struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                        `json:"id"`
	Provider CustomProvidersListOutputItemsScmRepoProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersListOutputItemsProviderPublisher represents the custom providers list output items provider publisher type.
type CustomProvidersListOutputItemsProviderPublisher struct {
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

// CustomProvidersListOutputItemsProviderCurrentVersion represents the custom providers list output items provider current version type.
type CustomProvidersListOutputItemsProviderCurrentVersion struct {
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

// CustomProvidersListOutputItemsProviderOauthAutoRegistration represents the custom providers list output items provider oauth auto registration type.
type CustomProvidersListOutputItemsProviderOauthAutoRegistration struct {
	// Status - Auto-registration status
	Status string `json:"status"`
}

// CustomProvidersListOutputItemsProviderOauth represents the custom providers list output items provider oauth type.
type CustomProvidersListOutputItemsProviderOauth struct {
	// Status - OAuth status
	Status string `json:"status"`
	// CallbackUrl - OAuth callback URL
	CallbackUrl      *string                                                     `json:"callback_url,omitempty"`
	AutoRegistration CustomProvidersListOutputItemsProviderOauthAutoRegistration `json:"auto_registration"`
}

// CustomProvidersListOutputItemsProvider represents the custom providers list output items provider type.
type CustomProvidersListOutputItemsProvider struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique provider identifier
	Id string `json:"id"`
	// Access - Access level of the provider
	Access string `json:"access"`
	// Status - Current status of the provider
	Status         string                                                `json:"status"`
	Publisher      CustomProvidersListOutputItemsProviderPublisher       `json:"publisher"`
	CurrentVersion *CustomProvidersListOutputItemsProviderCurrentVersion `json:"current_version,omitempty"`
	Oauth          *CustomProvidersListOutputItemsProviderOauth          `json:"oauth,omitempty"`
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

// CustomProvidersListOutputItems represents the custom providers list output items type.
type CustomProvidersListOutputItems struct {
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
	Metadata *map[string]any                         `json:"metadata,omitempty"`
	Draft    CustomProvidersListOutputItemsDraft     `json:"draft"`
	ScmRepo  *CustomProvidersListOutputItemsScmRepo  `json:"scm_repo,omitempty"`
	Provider *CustomProvidersListOutputItemsProvider `json:"provider,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersListOutputPagination represents the custom providers list output pagination type.
type CustomProvidersListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// CustomProvidersListOutput represents the custom providers list output type.
type CustomProvidersListOutput struct {
	Items      []CustomProvidersListOutputItems    `json:"items"`
	Pagination CustomProvidersListOutputPagination `json:"pagination"`
}

// MapCustomProvidersListOutputFromJSON deserializes JSON data into a CustomProvidersListOutput.
func MapCustomProvidersListOutputFromJSON(data []byte) (*CustomProvidersListOutput, error) {
	var v CustomProvidersListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersListOutputToJSON serializes a CustomProvidersListOutput to JSON.
func MapCustomProvidersListOutputToJSON(v *CustomProvidersListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CustomProvidersListQuery represents the custom providers list query type.
type CustomProvidersListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by status (active, archived)
	Status *any `json:"status,omitempty"`
	// Type - Filter by type (container, function, remote)
	Type *any `json:"type,omitempty"`
	// Id - Filter by custom provider IDs
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider IDs (matches providers connected to sessions)
	ProviderId *any `json:"provider_id,omitempty"`
	// Search - Search by name or description
	Search *string `json:"search,omitempty"`
}

// MapCustomProvidersListQueryFromJSON deserializes JSON data into a CustomProvidersListQuery.
func MapCustomProvidersListQueryFromJSON(data []byte) (*CustomProvidersListQuery, error) {
	var v CustomProvidersListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersListQueryToJSON serializes a CustomProvidersListQuery to JSON.
func MapCustomProvidersListQueryToJSON(v *CustomProvidersListQuery) ([]byte, error) {
	return json.Marshal(v)
}
