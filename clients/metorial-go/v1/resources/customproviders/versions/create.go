package versions

import (
	"encoding/json"
	"time"
)

// CustomProvidersVersionsCreateOutputConfigSchema represents the custom providers versions create output config schema type.
type CustomProvidersVersionsCreateOutputConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersVersionsCreateOutputConfig represents the custom providers versions create output config type.
type CustomProvidersVersionsCreateOutputConfig struct {
	// Object - String representing the object's type
	Object string                                          `json:"object"`
	Schema CustomProvidersVersionsCreateOutputConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersVersionsCreateOutputDeploymentCommit represents the custom providers versions create output deployment commit type.
type CustomProvidersVersionsCreateOutputDeploymentCommit struct {
	Object string `json:"object"`
	// Id - Commit identifier
	Id string `json:"id"`
	// Type - Commit type
	Type string `json:"type"`
	// Message - Commit message
	Message *string `json:"message,omitempty"`
	// CreatedAt - Timestamp when commit was created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsCreateOutputDeploymentImmutableBucketScmRepoLinkRepositoryProvider represents the custom providers versions create output deployment immutable bucket scm repo link repository provider type.
type CustomProvidersVersionsCreateOutputDeploymentImmutableBucketScmRepoLinkRepositoryProvider struct {
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

// CustomProvidersVersionsCreateOutputDeploymentImmutableBucketScmRepoLinkRepository represents the custom providers versions create output deployment immutable bucket scm repo link repository type.
type CustomProvidersVersionsCreateOutputDeploymentImmutableBucketScmRepoLinkRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                    `json:"id"`
	Provider CustomProvidersVersionsCreateOutputDeploymentImmutableBucketScmRepoLinkRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsCreateOutputDeploymentImmutableBucketScmRepoLink represents the custom providers versions create output deployment immutable bucket scm repo link type.
type CustomProvidersVersionsCreateOutputDeploymentImmutableBucketScmRepoLink struct {
	Object   string `json:"object"`
	IsLinked string `json:"is_linked"`
	// Path - Path within the SCM repository
	Path       *string                                                                           `json:"path,omitempty"`
	Repository CustomProvidersVersionsCreateOutputDeploymentImmutableBucketScmRepoLinkRepository `json:"repository"`
}

// CustomProvidersVersionsCreateOutputDeploymentImmutableBucket represents the custom providers versions create output deployment immutable bucket type.
type CustomProvidersVersionsCreateOutputDeploymentImmutableBucket struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique bucket identifier
	Id string `json:"id"`
	// IsImmutable - Whether the bucket is immutable
	IsImmutable bool `json:"is_immutable"`
	// IsReadOnly - Whether the bucket is read-only
	IsReadOnly  bool                                                                     `json:"is_read_only"`
	ScmRepoLink *CustomProvidersVersionsCreateOutputDeploymentImmutableBucketScmRepoLink `json:"scm_repo_link,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsCreateOutputDeploymentActor represents the custom providers versions create output deployment actor type.
type CustomProvidersVersionsCreateOutputDeploymentActor struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Actor identifier
	Id string `json:"id"`
	// Type - Actor type
	Type string `json:"type"`
	// Identifier - Actor unique identifier
	Identifier string `json:"identifier"`
	// Name - Actor display name
	Name string `json:"name"`
	// OrganizationActorId - Organization actor ID if linked
	OrganizationActorId *string `json:"organization_actor_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsCreateOutputDeploymentScmPushActor represents the custom providers versions create output deployment scm push actor type.
type CustomProvidersVersionsCreateOutputDeploymentScmPushActor struct {
	Object string `json:"object"`
	// Id - Actor identifier
	Id string `json:"id"`
	// ExternalId - External actor identifier
	ExternalId *string `json:"external_id,omitempty"`
	// Name - Actor name
	Name *string `json:"name,omitempty"`
	// Email - Actor email
	Email *string `json:"email,omitempty"`
}

// CustomProvidersVersionsCreateOutputDeploymentScmPushCommit represents the custom providers versions create output deployment scm push commit type.
type CustomProvidersVersionsCreateOutputDeploymentScmPushCommit struct {
	Object string `json:"object"`
	// Id - Commit identifier
	Id string `json:"id"`
	// Sha - Commit SHA
	Sha string `json:"sha"`
	// Branch - Branch name
	Branch string `json:"branch"`
	// Message - Commit message
	Message *string `json:"message,omitempty"`
	// CreatedAt - Timestamp when commit was created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsCreateOutputDeploymentScmPushRepositoryProvider represents the custom providers versions create output deployment scm push repository provider type.
type CustomProvidersVersionsCreateOutputDeploymentScmPushRepositoryProvider struct {
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

// CustomProvidersVersionsCreateOutputDeploymentScmPushRepository represents the custom providers versions create output deployment scm push repository type.
type CustomProvidersVersionsCreateOutputDeploymentScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                 `json:"id"`
	Provider CustomProvidersVersionsCreateOutputDeploymentScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsCreateOutputDeploymentScmPush represents the custom providers versions create output deployment scm push type.
type CustomProvidersVersionsCreateOutputDeploymentScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                                         `json:"id"`
	Actor      CustomProvidersVersionsCreateOutputDeploymentScmPushActor      `json:"actor"`
	Commit     CustomProvidersVersionsCreateOutputDeploymentScmPushCommit     `json:"commit"`
	Repository CustomProvidersVersionsCreateOutputDeploymentScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsCreateOutputDeployment represents the custom providers versions create output deployment type.
type CustomProvidersVersionsCreateOutputDeployment struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider deployment identifier
	Id string `json:"id"`
	// Status - Current deployment status
	Status string `json:"status"`
	// Trigger - What triggered this deployment
	Trigger string `json:"trigger"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId *string `json:"provider_id,omitempty"`
	// CustomProviderVersionId - ID of the custom provider version being deployed
	CustomProviderVersionId *string                                                       `json:"custom_provider_version_id,omitempty"`
	Commit                  *CustomProvidersVersionsCreateOutputDeploymentCommit          `json:"commit,omitempty"`
	ImmutableBucket         *CustomProvidersVersionsCreateOutputDeploymentImmutableBucket `json:"immutable_bucket,omitempty"`
	Actor                   CustomProvidersVersionsCreateOutputDeploymentActor            `json:"actor"`
	ScmPush                 *CustomProvidersVersionsCreateOutputDeploymentScmPush         `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersVersionsCreateOutputEnvironmentsEnvironment represents the custom providers versions create output environments environment type.
type CustomProvidersVersionsCreateOutputEnvironmentsEnvironment struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider environment identifier
	Id string `json:"id"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId *string `json:"provider_id,omitempty"`
	// CurrentProviderVersionId - ID of the current provider version in this environment
	CurrentProviderVersionId *string `json:"current_provider_version_id,omitempty"`
	// InstanceId - ID of the instance this environment is associated with
	InstanceId string `json:"instance_id"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersVersionsCreateOutputEnvironments represents the custom providers versions create output environments type.
type CustomProvidersVersionsCreateOutputEnvironments struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Environment version reference identifier
	Id string `json:"id"`
	// IsCurrentVersionForEnvironment - Whether this version is the current one for the environment
	IsCurrentVersionForEnvironment bool                                                       `json:"is_current_version_for_environment"`
	Environment                    CustomProvidersVersionsCreateOutputEnvironmentsEnvironment `json:"environment"`
}

// CustomProvidersVersionsCreateOutputActor represents the custom providers versions create output actor type.
type CustomProvidersVersionsCreateOutputActor struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Actor identifier
	Id string `json:"id"`
	// Type - Actor type
	Type string `json:"type"`
	// Identifier - Actor unique identifier
	Identifier string `json:"identifier"`
	// Name - Actor display name
	Name string `json:"name"`
	// OrganizationActorId - Organization actor ID if linked
	OrganizationActorId *string `json:"organization_actor_id,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsCreateOutputContainerImage represents the custom providers versions create output container image type.
type CustomProvidersVersionsCreateOutputContainerImage struct {
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersVersionsCreateOutputRemoteMcpServer represents the custom providers versions create output remote mcp server type.
type CustomProvidersVersionsCreateOutputRemoteMcpServer struct {
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersVersionsCreateOutput represents the custom providers versions create output type.
type CustomProvidersVersionsCreateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider version identifier
	Id string `json:"id"`
	// Status - Current version status
	Status string                                     `json:"status"`
	Config *CustomProvidersVersionsCreateOutputConfig `json:"config,omitempty"`
	// Index - Version index number
	Index float64 `json:"index"`
	// Identifier - Version identifier
	Identifier string                                        `json:"identifier"`
	Deployment CustomProvidersVersionsCreateOutputDeployment `json:"deployment"`
	// Environments - Environments this version is deployed to
	Environments []CustomProvidersVersionsCreateOutputEnvironments `json:"environments"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId      *string                                             `json:"provider_id,omitempty"`
	Actor           CustomProvidersVersionsCreateOutputActor            `json:"actor"`
	ContainerImage  *CustomProvidersVersionsCreateOutputContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersVersionsCreateOutputRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCustomProvidersVersionsCreateOutputFromJSON deserializes JSON data into a CustomProvidersVersionsCreateOutput.
func MapCustomProvidersVersionsCreateOutputFromJSON(data []byte) (*CustomProvidersVersionsCreateOutput, error) {
	var v CustomProvidersVersionsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersVersionsCreateOutputToJSON serializes a CustomProvidersVersionsCreateOutput to JSON.
func MapCustomProvidersVersionsCreateOutputToJSON(v *CustomProvidersVersionsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CustomProvidersVersionsCreateBodyFromFiles represents the custom providers versions create body from files type.
type CustomProvidersVersionsCreateBodyFromFiles struct {
	// Filename - File name
	Filename string `json:"filename"`
	// Content - File content
	Content string `json:"content"`
	// Encoding - Content encoding
	Encoding *string `json:"encoding,omitempty"`
}

// CustomProvidersVersionsCreateBodyFromRuntime represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type CustomProvidersVersionsCreateBodyFromRuntime struct {
	Identifier *string `json:"identifier,omitempty"`
	// Version - Python version
	Version *string `json:"version,omitempty"`
}

// CustomProvidersVersionsCreateBodyFromRepository represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type CustomProvidersVersionsCreateBodyFromRepository struct {
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

// CustomProvidersVersionsCreateBodyFrom represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type CustomProvidersVersionsCreateBodyFrom struct {
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
	Files *[]CustomProvidersVersionsCreateBodyFromFiles `json:"files,omitempty"`
	// Env - Environment variables
	Env        *map[string]string                               `json:"env,omitempty"`
	Runtime    *CustomProvidersVersionsCreateBodyFromRuntime    `json:"runtime,omitempty"`
	Repository *CustomProvidersVersionsCreateBodyFromRepository `json:"repository,omitempty"`
}

// CustomProvidersVersionsCreateBodyConfig represents the custom providers versions create body config type.
type CustomProvidersVersionsCreateBodyConfig struct {
	// Schema - Configuration JSON schema
	Schema map[string]any `json:"schema"`
	// Transformer - Configuration transformer code
	Transformer string `json:"transformer"`
}

// CustomProvidersVersionsCreateBody represents the custom providers versions create body type.
type CustomProvidersVersionsCreateBody struct {
	// CustomProviderId - Custom provider ID
	CustomProviderId string                                   `json:"custom_provider_id"`
	From             CustomProvidersVersionsCreateBodyFrom    `json:"from"`
	Config           *CustomProvidersVersionsCreateBodyConfig `json:"config,omitempty"`
}

// MapCustomProvidersVersionsCreateBodyFromJSON deserializes JSON data into a CustomProvidersVersionsCreateBody.
func MapCustomProvidersVersionsCreateBodyFromJSON(data []byte) (*CustomProvidersVersionsCreateBody, error) {
	var v CustomProvidersVersionsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersVersionsCreateBodyToJSON serializes a CustomProvidersVersionsCreateBody to JSON.
func MapCustomProvidersVersionsCreateBodyToJSON(v *CustomProvidersVersionsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
