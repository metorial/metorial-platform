package commits

import (
	"encoding/json"
	"time"
)

// CustomProvidersCommitsCreateOutputError represents the custom providers commits create output error type.
type CustomProvidersCommitsCreateOutputError struct {
	// Code - Error code
	Code string `json:"code"`
	// Message - Error message
	Message string `json:"message"`
}

// CustomProvidersCommitsCreateOutputToEnvironment represents the custom providers commits create output to environment type.
type CustomProvidersCommitsCreateOutputToEnvironment struct {
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

// CustomProvidersCommitsCreateOutputFromEnvironment represents the custom providers commits create output from environment type.
type CustomProvidersCommitsCreateOutputFromEnvironment struct {
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

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionConfigSchema represents the custom providers commits create output target custom provider version config schema type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionConfig represents the custom providers commits create output target custom provider version config type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionConfig struct {
	// Object - String representing the object's type
	Object string                                                                    `json:"object"`
	Schema CustomProvidersCommitsCreateOutputTargetCustomProviderVersionConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentCommit represents the custom providers commits create output target custom provider version deployment commit type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentCommit struct {
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

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider represents the custom providers commits create output target custom provider version deployment immutable bucket scm repo link repository provider type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider struct {
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

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository represents the custom providers commits create output target custom provider version deployment immutable bucket scm repo link repository type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                                              `json:"id"`
	Provider CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLink represents the custom providers commits create output target custom provider version deployment immutable bucket scm repo link type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLink struct {
	Object   string `json:"object"`
	IsLinked string `json:"is_linked"`
	// Path - Path within the SCM repository
	Path       *string                                                                                                     `json:"path,omitempty"`
	Repository CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository `json:"repository"`
}

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentImmutableBucket represents the custom providers commits create output target custom provider version deployment immutable bucket type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentImmutableBucket struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique bucket identifier
	Id string `json:"id"`
	// IsImmutable - Whether the bucket is immutable
	IsImmutable bool `json:"is_immutable"`
	// IsReadOnly - Whether the bucket is read-only
	IsReadOnly  bool                                                                                               `json:"is_read_only"`
	ScmRepoLink *CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLink `json:"scm_repo_link,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentActor represents the custom providers commits create output target custom provider version deployment actor type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentActor struct {
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

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPushActor represents the custom providers commits create output target custom provider version deployment scm push actor type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPushActor struct {
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

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPushCommit represents the custom providers commits create output target custom provider version deployment scm push commit type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPushCommit struct {
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

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPushRepositoryProvider represents the custom providers commits create output target custom provider version deployment scm push repository provider type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPushRepositoryProvider struct {
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

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPushRepository represents the custom providers commits create output target custom provider version deployment scm push repository type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                           `json:"id"`
	Provider CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPush represents the custom providers commits create output target custom provider version deployment scm push type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                                                                   `json:"id"`
	Actor      CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPushActor      `json:"actor"`
	Commit     CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPushCommit     `json:"commit"`
	Repository CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeployment represents the custom providers commits create output target custom provider version deployment type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeployment struct {
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
	CustomProviderVersionId *string                                                                                 `json:"custom_provider_version_id,omitempty"`
	Commit                  *CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentCommit          `json:"commit,omitempty"`
	ImmutableBucket         *CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentImmutableBucket `json:"immutable_bucket,omitempty"`
	Actor                   CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentActor            `json:"actor"`
	ScmPush                 *CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeploymentScmPush         `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionEnvironmentsEnvironment represents the custom providers commits create output target custom provider version environments environment type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionEnvironmentsEnvironment struct {
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

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionEnvironments represents the custom providers commits create output target custom provider version environments type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionEnvironments struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Environment version reference identifier
	Id string `json:"id"`
	// IsCurrentVersionForEnvironment - Whether this version is the current one for the environment
	IsCurrentVersionForEnvironment bool                                                                                 `json:"is_current_version_for_environment"`
	Environment                    CustomProvidersCommitsCreateOutputTargetCustomProviderVersionEnvironmentsEnvironment `json:"environment"`
}

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionActor represents the custom providers commits create output target custom provider version actor type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionActor struct {
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

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionContainerImage represents the custom providers commits create output target custom provider version container image type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionContainerImage struct {
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersionRemoteMcpServer represents the custom providers commits create output target custom provider version remote mcp server type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersionRemoteMcpServer struct {
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersCommitsCreateOutputTargetCustomProviderVersion represents the custom providers commits create output target custom provider version type.
type CustomProvidersCommitsCreateOutputTargetCustomProviderVersion struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider version identifier
	Id string `json:"id"`
	// Status - Current version status
	Status string                                                               `json:"status"`
	Config *CustomProvidersCommitsCreateOutputTargetCustomProviderVersionConfig `json:"config,omitempty"`
	// Index - Version index number
	Index float64 `json:"index"`
	// Identifier - Version identifier
	Identifier string                                                                  `json:"identifier"`
	Deployment CustomProvidersCommitsCreateOutputTargetCustomProviderVersionDeployment `json:"deployment"`
	// Environments - Environments this version is deployed to
	Environments []CustomProvidersCommitsCreateOutputTargetCustomProviderVersionEnvironments `json:"environments"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId      *string                                                                       `json:"provider_id,omitempty"`
	Actor           CustomProvidersCommitsCreateOutputTargetCustomProviderVersionActor            `json:"actor"`
	ContainerImage  *CustomProvidersCommitsCreateOutputTargetCustomProviderVersionContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersCommitsCreateOutputTargetCustomProviderVersionRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionConfigSchema represents the custom providers commits create output previous custom provider version config schema type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionConfig represents the custom providers commits create output previous custom provider version config type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionConfig struct {
	// Object - String representing the object's type
	Object string                                                                      `json:"object"`
	Schema CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentCommit represents the custom providers commits create output previous custom provider version deployment commit type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentCommit struct {
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

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider represents the custom providers commits create output previous custom provider version deployment immutable bucket scm repo link repository provider type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider struct {
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

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository represents the custom providers commits create output previous custom provider version deployment immutable bucket scm repo link repository type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                                                `json:"id"`
	Provider CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLink represents the custom providers commits create output previous custom provider version deployment immutable bucket scm repo link type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLink struct {
	Object   string `json:"object"`
	IsLinked string `json:"is_linked"`
	// Path - Path within the SCM repository
	Path       *string                                                                                                       `json:"path,omitempty"`
	Repository CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository `json:"repository"`
}

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentImmutableBucket represents the custom providers commits create output previous custom provider version deployment immutable bucket type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentImmutableBucket struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique bucket identifier
	Id string `json:"id"`
	// IsImmutable - Whether the bucket is immutable
	IsImmutable bool `json:"is_immutable"`
	// IsReadOnly - Whether the bucket is read-only
	IsReadOnly  bool                                                                                                 `json:"is_read_only"`
	ScmRepoLink *CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLink `json:"scm_repo_link,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentActor represents the custom providers commits create output previous custom provider version deployment actor type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentActor struct {
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

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPushActor represents the custom providers commits create output previous custom provider version deployment scm push actor type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPushActor struct {
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

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPushCommit represents the custom providers commits create output previous custom provider version deployment scm push commit type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPushCommit struct {
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

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPushRepositoryProvider represents the custom providers commits create output previous custom provider version deployment scm push repository provider type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPushRepositoryProvider struct {
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

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPushRepository represents the custom providers commits create output previous custom provider version deployment scm push repository type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                             `json:"id"`
	Provider CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPush represents the custom providers commits create output previous custom provider version deployment scm push type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                                                                     `json:"id"`
	Actor      CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPushActor      `json:"actor"`
	Commit     CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPushCommit     `json:"commit"`
	Repository CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeployment represents the custom providers commits create output previous custom provider version deployment type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeployment struct {
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
	CustomProviderVersionId *string                                                                                   `json:"custom_provider_version_id,omitempty"`
	Commit                  *CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentCommit          `json:"commit,omitempty"`
	ImmutableBucket         *CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentImmutableBucket `json:"immutable_bucket,omitempty"`
	Actor                   CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentActor            `json:"actor"`
	ScmPush                 *CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeploymentScmPush         `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionEnvironmentsEnvironment represents the custom providers commits create output previous custom provider version environments environment type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionEnvironmentsEnvironment struct {
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

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionEnvironments represents the custom providers commits create output previous custom provider version environments type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionEnvironments struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Environment version reference identifier
	Id string `json:"id"`
	// IsCurrentVersionForEnvironment - Whether this version is the current one for the environment
	IsCurrentVersionForEnvironment bool                                                                                   `json:"is_current_version_for_environment"`
	Environment                    CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionEnvironmentsEnvironment `json:"environment"`
}

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionActor represents the custom providers commits create output previous custom provider version actor type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionActor struct {
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

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionContainerImage represents the custom providers commits create output previous custom provider version container image type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionContainerImage struct {
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionRemoteMcpServer represents the custom providers commits create output previous custom provider version remote mcp server type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionRemoteMcpServer struct {
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersCommitsCreateOutputPreviousCustomProviderVersion represents the custom providers commits create output previous custom provider version type.
type CustomProvidersCommitsCreateOutputPreviousCustomProviderVersion struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider version identifier
	Id string `json:"id"`
	// Status - Current version status
	Status string                                                                 `json:"status"`
	Config *CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionConfig `json:"config,omitempty"`
	// Index - Version index number
	Index float64 `json:"index"`
	// Identifier - Version identifier
	Identifier string                                                                    `json:"identifier"`
	Deployment CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionDeployment `json:"deployment"`
	// Environments - Environments this version is deployed to
	Environments []CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionEnvironments `json:"environments"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId      *string                                                                         `json:"provider_id,omitempty"`
	Actor           CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionActor            `json:"actor"`
	ContainerImage  *CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersCommitsCreateOutputPreviousCustomProviderVersionRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersCommitsCreateOutputActor represents the custom providers commits create output actor type.
type CustomProvidersCommitsCreateOutputActor struct {
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

// CustomProvidersCommitsCreateOutputScmPushActor represents the custom providers commits create output scm push actor type.
type CustomProvidersCommitsCreateOutputScmPushActor struct {
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

// CustomProvidersCommitsCreateOutputScmPushCommit represents the custom providers commits create output scm push commit type.
type CustomProvidersCommitsCreateOutputScmPushCommit struct {
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

// CustomProvidersCommitsCreateOutputScmPushRepositoryProvider represents the custom providers commits create output scm push repository provider type.
type CustomProvidersCommitsCreateOutputScmPushRepositoryProvider struct {
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

// CustomProvidersCommitsCreateOutputScmPushRepository represents the custom providers commits create output scm push repository type.
type CustomProvidersCommitsCreateOutputScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                      `json:"id"`
	Provider CustomProvidersCommitsCreateOutputScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsCreateOutputScmPush represents the custom providers commits create output scm push type.
type CustomProvidersCommitsCreateOutputScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                              `json:"id"`
	Actor      CustomProvidersCommitsCreateOutputScmPushActor      `json:"actor"`
	Commit     CustomProvidersCommitsCreateOutputScmPushCommit     `json:"commit"`
	Repository CustomProvidersCommitsCreateOutputScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsCreateOutput represents the custom providers commits create output type.
type CustomProvidersCommitsCreateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider commit identifier
	Id string `json:"id"`
	// Status - Current commit status
	Status string `json:"status"`
	// Trigger - What triggered this commit
	Trigger string                                   `json:"trigger"`
	Error   *CustomProvidersCommitsCreateOutputError `json:"error,omitempty"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId *string `json:"provider_id,omitempty"`
	// CustomProviderDeploymentId - ID of the associated deployment
	CustomProviderDeploymentId    *string                                                          `json:"custom_provider_deployment_id,omitempty"`
	ToEnvironment                 CustomProvidersCommitsCreateOutputToEnvironment                  `json:"to_environment"`
	FromEnvironment               *CustomProvidersCommitsCreateOutputFromEnvironment               `json:"from_environment,omitempty"`
	TargetCustomProviderVersion   CustomProvidersCommitsCreateOutputTargetCustomProviderVersion    `json:"target_custom_provider_version"`
	PreviousCustomProviderVersion *CustomProvidersCommitsCreateOutputPreviousCustomProviderVersion `json:"previous_custom_provider_version,omitempty"`
	Actor                         CustomProvidersCommitsCreateOutputActor                          `json:"actor"`
	ScmPush                       *CustomProvidersCommitsCreateOutputScmPush                       `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// AppliedAt - Timestamp when the commit was applied
	AppliedAt *time.Time `json:"applied_at,omitempty"`
}

// MapCustomProvidersCommitsCreateOutputFromJSON deserializes JSON data into a CustomProvidersCommitsCreateOutput.
func MapCustomProvidersCommitsCreateOutputFromJSON(data []byte) (*CustomProvidersCommitsCreateOutput, error) {
	var v CustomProvidersCommitsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersCommitsCreateOutputToJSON serializes a CustomProvidersCommitsCreateOutput to JSON.
func MapCustomProvidersCommitsCreateOutputToJSON(v *CustomProvidersCommitsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CustomProvidersCommitsCreateBodyAction represents one of several possible types.
// This is a union type - only one set of fields will be populated.
type CustomProvidersCommitsCreateBodyAction struct {
	Type *string `json:"type,omitempty"`
	// FromEnvironmentId - Source environment ID
	FromEnvironmentId *string `json:"from_environment_id,omitempty"`
	// ToEnvironmentId - Target environment ID
	ToEnvironmentId *string `json:"to_environment_id,omitempty"`
	// EnvironmentId - Environment ID to rollback
	EnvironmentId *string `json:"environment_id,omitempty"`
	// VersionId - Version ID to rollback to
	VersionId *string `json:"version_id,omitempty"`
}

// CustomProvidersCommitsCreateBody represents the custom providers commits create body type.
type CustomProvidersCommitsCreateBody struct {
	// Message - Commit message
	Message string `json:"message"`
	// Action - The commit action to perform
	Action CustomProvidersCommitsCreateBodyAction `json:"action"`
}

// MapCustomProvidersCommitsCreateBodyFromJSON deserializes JSON data into a CustomProvidersCommitsCreateBody.
func MapCustomProvidersCommitsCreateBodyFromJSON(data []byte) (*CustomProvidersCommitsCreateBody, error) {
	var v CustomProvidersCommitsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersCommitsCreateBodyToJSON serializes a CustomProvidersCommitsCreateBody to JSON.
func MapCustomProvidersCommitsCreateBodyToJSON(v *CustomProvidersCommitsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
