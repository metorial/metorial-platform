package commits

import (
	"encoding/json"
	"time"
)

// CustomProvidersCommitsGetOutputError represents the custom providers commits get output error type.
type CustomProvidersCommitsGetOutputError struct {
	// Code - Error code
	Code string `json:"code"`
	// Message - Error message
	Message string `json:"message"`
}

// CustomProvidersCommitsGetOutputToEnvironment represents the custom providers commits get output to environment type.
type CustomProvidersCommitsGetOutputToEnvironment struct {
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

// CustomProvidersCommitsGetOutputFromEnvironment represents the custom providers commits get output from environment type.
type CustomProvidersCommitsGetOutputFromEnvironment struct {
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

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionConfigSchema represents the custom providers commits get output target custom provider version config schema type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionConfig represents the custom providers commits get output target custom provider version config type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionConfig struct {
	// Object - String representing the object's type
	Object string                                                                 `json:"object"`
	Schema CustomProvidersCommitsGetOutputTargetCustomProviderVersionConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentCommit represents the custom providers commits get output target custom provider version deployment commit type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentCommit struct {
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

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider represents the custom providers commits get output target custom provider version deployment immutable bucket scm repo link repository provider type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider struct {
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

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository represents the custom providers commits get output target custom provider version deployment immutable bucket scm repo link repository type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                                           `json:"id"`
	Provider CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLink represents the custom providers commits get output target custom provider version deployment immutable bucket scm repo link type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLink struct {
	Object   string `json:"object"`
	IsLinked string `json:"is_linked"`
	// Path - Path within the SCM repository
	Path       *string                                                                                                  `json:"path,omitempty"`
	Repository CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository `json:"repository"`
}

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentImmutableBucket represents the custom providers commits get output target custom provider version deployment immutable bucket type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentImmutableBucket struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique bucket identifier
	Id string `json:"id"`
	// IsImmutable - Whether the bucket is immutable
	IsImmutable bool `json:"is_immutable"`
	// IsReadOnly - Whether the bucket is read-only
	IsReadOnly  bool                                                                                            `json:"is_read_only"`
	ScmRepoLink *CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLink `json:"scm_repo_link,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentActor represents the custom providers commits get output target custom provider version deployment actor type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentActor struct {
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

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPushActor represents the custom providers commits get output target custom provider version deployment scm push actor type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPushActor struct {
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

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPushCommit represents the custom providers commits get output target custom provider version deployment scm push commit type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPushCommit struct {
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

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPushRepositoryProvider represents the custom providers commits get output target custom provider version deployment scm push repository provider type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPushRepositoryProvider struct {
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

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPushRepository represents the custom providers commits get output target custom provider version deployment scm push repository type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                        `json:"id"`
	Provider CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPush represents the custom providers commits get output target custom provider version deployment scm push type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                                                                `json:"id"`
	Actor      CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPushActor      `json:"actor"`
	Commit     CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPushCommit     `json:"commit"`
	Repository CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeployment represents the custom providers commits get output target custom provider version deployment type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeployment struct {
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
	CustomProviderVersionId *string                                                                              `json:"custom_provider_version_id,omitempty"`
	Commit                  *CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentCommit          `json:"commit,omitempty"`
	ImmutableBucket         *CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentImmutableBucket `json:"immutable_bucket,omitempty"`
	Actor                   CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentActor            `json:"actor"`
	ScmPush                 *CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeploymentScmPush         `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionEnvironmentsEnvironment represents the custom providers commits get output target custom provider version environments environment type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionEnvironmentsEnvironment struct {
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

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionEnvironments represents the custom providers commits get output target custom provider version environments type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionEnvironments struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Environment version reference identifier
	Id string `json:"id"`
	// IsCurrentVersionForEnvironment - Whether this version is the current one for the environment
	IsCurrentVersionForEnvironment bool                                                                              `json:"is_current_version_for_environment"`
	Environment                    CustomProvidersCommitsGetOutputTargetCustomProviderVersionEnvironmentsEnvironment `json:"environment"`
}

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionActor represents the custom providers commits get output target custom provider version actor type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionActor struct {
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

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionContainerImage represents the custom providers commits get output target custom provider version container image type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionContainerImage struct {
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersCommitsGetOutputTargetCustomProviderVersionRemoteMcpServer represents the custom providers commits get output target custom provider version remote mcp server type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersionRemoteMcpServer struct {
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersCommitsGetOutputTargetCustomProviderVersion represents the custom providers commits get output target custom provider version type.
type CustomProvidersCommitsGetOutputTargetCustomProviderVersion struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider version identifier
	Id string `json:"id"`
	// Status - Current version status
	Status string                                                            `json:"status"`
	Config *CustomProvidersCommitsGetOutputTargetCustomProviderVersionConfig `json:"config,omitempty"`
	// Index - Version index number
	Index float64 `json:"index"`
	// Identifier - Version identifier
	Identifier string                                                               `json:"identifier"`
	Deployment CustomProvidersCommitsGetOutputTargetCustomProviderVersionDeployment `json:"deployment"`
	// Environments - Environments this version is deployed to
	Environments []CustomProvidersCommitsGetOutputTargetCustomProviderVersionEnvironments `json:"environments"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId      *string                                                                    `json:"provider_id,omitempty"`
	Actor           CustomProvidersCommitsGetOutputTargetCustomProviderVersionActor            `json:"actor"`
	ContainerImage  *CustomProvidersCommitsGetOutputTargetCustomProviderVersionContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersCommitsGetOutputTargetCustomProviderVersionRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionConfigSchema represents the custom providers commits get output previous custom provider version config schema type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionConfig represents the custom providers commits get output previous custom provider version config type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionConfig struct {
	// Object - String representing the object's type
	Object string                                                                   `json:"object"`
	Schema CustomProvidersCommitsGetOutputPreviousCustomProviderVersionConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentCommit represents the custom providers commits get output previous custom provider version deployment commit type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentCommit struct {
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

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider represents the custom providers commits get output previous custom provider version deployment immutable bucket scm repo link repository provider type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider struct {
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

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository represents the custom providers commits get output previous custom provider version deployment immutable bucket scm repo link repository type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                                             `json:"id"`
	Provider CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLink represents the custom providers commits get output previous custom provider version deployment immutable bucket scm repo link type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLink struct {
	Object   string `json:"object"`
	IsLinked string `json:"is_linked"`
	// Path - Path within the SCM repository
	Path       *string                                                                                                    `json:"path,omitempty"`
	Repository CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository `json:"repository"`
}

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentImmutableBucket represents the custom providers commits get output previous custom provider version deployment immutable bucket type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentImmutableBucket struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique bucket identifier
	Id string `json:"id"`
	// IsImmutable - Whether the bucket is immutable
	IsImmutable bool `json:"is_immutable"`
	// IsReadOnly - Whether the bucket is read-only
	IsReadOnly  bool                                                                                              `json:"is_read_only"`
	ScmRepoLink *CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLink `json:"scm_repo_link,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentActor represents the custom providers commits get output previous custom provider version deployment actor type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentActor struct {
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

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPushActor represents the custom providers commits get output previous custom provider version deployment scm push actor type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPushActor struct {
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

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPushCommit represents the custom providers commits get output previous custom provider version deployment scm push commit type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPushCommit struct {
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

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPushRepositoryProvider represents the custom providers commits get output previous custom provider version deployment scm push repository provider type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPushRepositoryProvider struct {
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

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPushRepository represents the custom providers commits get output previous custom provider version deployment scm push repository type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                          `json:"id"`
	Provider CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPush represents the custom providers commits get output previous custom provider version deployment scm push type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                                                                  `json:"id"`
	Actor      CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPushActor      `json:"actor"`
	Commit     CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPushCommit     `json:"commit"`
	Repository CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeployment represents the custom providers commits get output previous custom provider version deployment type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeployment struct {
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
	CustomProviderVersionId *string                                                                                `json:"custom_provider_version_id,omitempty"`
	Commit                  *CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentCommit          `json:"commit,omitempty"`
	ImmutableBucket         *CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentImmutableBucket `json:"immutable_bucket,omitempty"`
	Actor                   CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentActor            `json:"actor"`
	ScmPush                 *CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeploymentScmPush         `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionEnvironmentsEnvironment represents the custom providers commits get output previous custom provider version environments environment type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionEnvironmentsEnvironment struct {
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

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionEnvironments represents the custom providers commits get output previous custom provider version environments type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionEnvironments struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Environment version reference identifier
	Id string `json:"id"`
	// IsCurrentVersionForEnvironment - Whether this version is the current one for the environment
	IsCurrentVersionForEnvironment bool                                                                                `json:"is_current_version_for_environment"`
	Environment                    CustomProvidersCommitsGetOutputPreviousCustomProviderVersionEnvironmentsEnvironment `json:"environment"`
}

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionActor represents the custom providers commits get output previous custom provider version actor type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionActor struct {
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

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionContainerImage represents the custom providers commits get output previous custom provider version container image type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionContainerImage struct {
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersionRemoteMcpServer represents the custom providers commits get output previous custom provider version remote mcp server type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersionRemoteMcpServer struct {
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersCommitsGetOutputPreviousCustomProviderVersion represents the custom providers commits get output previous custom provider version type.
type CustomProvidersCommitsGetOutputPreviousCustomProviderVersion struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider version identifier
	Id string `json:"id"`
	// Status - Current version status
	Status string                                                              `json:"status"`
	Config *CustomProvidersCommitsGetOutputPreviousCustomProviderVersionConfig `json:"config,omitempty"`
	// Index - Version index number
	Index float64 `json:"index"`
	// Identifier - Version identifier
	Identifier string                                                                 `json:"identifier"`
	Deployment CustomProvidersCommitsGetOutputPreviousCustomProviderVersionDeployment `json:"deployment"`
	// Environments - Environments this version is deployed to
	Environments []CustomProvidersCommitsGetOutputPreviousCustomProviderVersionEnvironments `json:"environments"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId      *string                                                                      `json:"provider_id,omitempty"`
	Actor           CustomProvidersCommitsGetOutputPreviousCustomProviderVersionActor            `json:"actor"`
	ContainerImage  *CustomProvidersCommitsGetOutputPreviousCustomProviderVersionContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersCommitsGetOutputPreviousCustomProviderVersionRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersCommitsGetOutputActor represents the custom providers commits get output actor type.
type CustomProvidersCommitsGetOutputActor struct {
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

// CustomProvidersCommitsGetOutputScmPushActor represents the custom providers commits get output scm push actor type.
type CustomProvidersCommitsGetOutputScmPushActor struct {
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

// CustomProvidersCommitsGetOutputScmPushCommit represents the custom providers commits get output scm push commit type.
type CustomProvidersCommitsGetOutputScmPushCommit struct {
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

// CustomProvidersCommitsGetOutputScmPushRepositoryProvider represents the custom providers commits get output scm push repository provider type.
type CustomProvidersCommitsGetOutputScmPushRepositoryProvider struct {
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

// CustomProvidersCommitsGetOutputScmPushRepository represents the custom providers commits get output scm push repository type.
type CustomProvidersCommitsGetOutputScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                   `json:"id"`
	Provider CustomProvidersCommitsGetOutputScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsGetOutputScmPush represents the custom providers commits get output scm push type.
type CustomProvidersCommitsGetOutputScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                           `json:"id"`
	Actor      CustomProvidersCommitsGetOutputScmPushActor      `json:"actor"`
	Commit     CustomProvidersCommitsGetOutputScmPushCommit     `json:"commit"`
	Repository CustomProvidersCommitsGetOutputScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsGetOutput represents the custom providers commits get output type.
type CustomProvidersCommitsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider commit identifier
	Id string `json:"id"`
	// Status - Current commit status
	Status string `json:"status"`
	// Trigger - What triggered this commit
	Trigger string                                `json:"trigger"`
	Error   *CustomProvidersCommitsGetOutputError `json:"error,omitempty"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId *string `json:"provider_id,omitempty"`
	// CustomProviderDeploymentId - ID of the associated deployment
	CustomProviderDeploymentId    *string                                                       `json:"custom_provider_deployment_id,omitempty"`
	ToEnvironment                 CustomProvidersCommitsGetOutputToEnvironment                  `json:"to_environment"`
	FromEnvironment               *CustomProvidersCommitsGetOutputFromEnvironment               `json:"from_environment,omitempty"`
	TargetCustomProviderVersion   CustomProvidersCommitsGetOutputTargetCustomProviderVersion    `json:"target_custom_provider_version"`
	PreviousCustomProviderVersion *CustomProvidersCommitsGetOutputPreviousCustomProviderVersion `json:"previous_custom_provider_version,omitempty"`
	Actor                         CustomProvidersCommitsGetOutputActor                          `json:"actor"`
	ScmPush                       *CustomProvidersCommitsGetOutputScmPush                       `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// AppliedAt - Timestamp when the commit was applied
	AppliedAt *time.Time `json:"applied_at,omitempty"`
}

// MapCustomProvidersCommitsGetOutputFromJSON deserializes JSON data into a CustomProvidersCommitsGetOutput.
func MapCustomProvidersCommitsGetOutputFromJSON(data []byte) (*CustomProvidersCommitsGetOutput, error) {
	var v CustomProvidersCommitsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersCommitsGetOutputToJSON serializes a CustomProvidersCommitsGetOutput to JSON.
func MapCustomProvidersCommitsGetOutputToJSON(v *CustomProvidersCommitsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
