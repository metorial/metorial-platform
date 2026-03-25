package commits

import (
	"encoding/json"
	"time"
)

// CustomProvidersCommitsListOutputItemsError represents the custom providers commits list output items error type.
type CustomProvidersCommitsListOutputItemsError struct {
	// Code - Error code
	Code string `json:"code"`
	// Message - Error message
	Message string `json:"message"`
}

// CustomProvidersCommitsListOutputItemsToEnvironment represents the custom providers commits list output items to environment type.
type CustomProvidersCommitsListOutputItemsToEnvironment struct {
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

// CustomProvidersCommitsListOutputItemsFromEnvironment represents the custom providers commits list output items from environment type.
type CustomProvidersCommitsListOutputItemsFromEnvironment struct {
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

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionConfigSchema represents the custom providers commits list output items target custom provider version config schema type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionConfig represents the custom providers commits list output items target custom provider version config type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionConfig struct {
	// Object - String representing the object's type
	Object string                                                                       `json:"object"`
	Schema CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentCommit represents the custom providers commits list output items target custom provider version deployment commit type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentCommit struct {
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

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider represents the custom providers commits list output items target custom provider version deployment immutable bucket scm repo link repository provider type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider struct {
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

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository represents the custom providers commits list output items target custom provider version deployment immutable bucket scm repo link repository type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                                                 `json:"id"`
	Provider CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLink represents the custom providers commits list output items target custom provider version deployment immutable bucket scm repo link type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLink struct {
	Object   string `json:"object"`
	IsLinked string `json:"is_linked"`
	// Path - Path within the SCM repository
	Path       *string                                                                                                        `json:"path,omitempty"`
	Repository CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository `json:"repository"`
}

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentImmutableBucket represents the custom providers commits list output items target custom provider version deployment immutable bucket type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentImmutableBucket struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique bucket identifier
	Id string `json:"id"`
	// IsImmutable - Whether the bucket is immutable
	IsImmutable bool `json:"is_immutable"`
	// IsReadOnly - Whether the bucket is read-only
	IsReadOnly  bool                                                                                                  `json:"is_read_only"`
	ScmRepoLink *CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentImmutableBucketScmRepoLink `json:"scm_repo_link,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentActor represents the custom providers commits list output items target custom provider version deployment actor type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentActor struct {
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

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPushActor represents the custom providers commits list output items target custom provider version deployment scm push actor type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPushActor struct {
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

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPushCommit represents the custom providers commits list output items target custom provider version deployment scm push commit type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPushCommit struct {
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

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPushRepositoryProvider represents the custom providers commits list output items target custom provider version deployment scm push repository provider type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPushRepositoryProvider struct {
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

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPushRepository represents the custom providers commits list output items target custom provider version deployment scm push repository type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                              `json:"id"`
	Provider CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPush represents the custom providers commits list output items target custom provider version deployment scm push type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                                                                      `json:"id"`
	Actor      CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPushActor      `json:"actor"`
	Commit     CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPushCommit     `json:"commit"`
	Repository CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeployment represents the custom providers commits list output items target custom provider version deployment type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeployment struct {
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
	CustomProviderVersionId *string                                                                                    `json:"custom_provider_version_id,omitempty"`
	Commit                  *CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentCommit          `json:"commit,omitempty"`
	ImmutableBucket         *CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentImmutableBucket `json:"immutable_bucket,omitempty"`
	Actor                   CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentActor            `json:"actor"`
	ScmPush                 *CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeploymentScmPush         `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionEnvironmentsEnvironment represents the custom providers commits list output items target custom provider version environments environment type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionEnvironmentsEnvironment struct {
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

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionEnvironments represents the custom providers commits list output items target custom provider version environments type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionEnvironments struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Environment version reference identifier
	Id string `json:"id"`
	// IsCurrentVersionForEnvironment - Whether this version is the current one for the environment
	IsCurrentVersionForEnvironment bool                                                                                    `json:"is_current_version_for_environment"`
	Environment                    CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionEnvironmentsEnvironment `json:"environment"`
}

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionActor represents the custom providers commits list output items target custom provider version actor type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionActor struct {
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

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionContainerImage represents the custom providers commits list output items target custom provider version container image type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionContainerImage struct {
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionRemoteMcpServer represents the custom providers commits list output items target custom provider version remote mcp server type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionRemoteMcpServer struct {
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersCommitsListOutputItemsTargetCustomProviderVersion represents the custom providers commits list output items target custom provider version type.
type CustomProvidersCommitsListOutputItemsTargetCustomProviderVersion struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider version identifier
	Id string `json:"id"`
	// Status - Current version status
	Status string                                                                  `json:"status"`
	Config *CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionConfig `json:"config,omitempty"`
	// Index - Version index number
	Index float64 `json:"index"`
	// Identifier - Version identifier
	Identifier string                                                                     `json:"identifier"`
	Deployment CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionDeployment `json:"deployment"`
	// Environments - Environments this version is deployed to
	Environments []CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionEnvironments `json:"environments"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId      *string                                                                          `json:"provider_id,omitempty"`
	Actor           CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionActor            `json:"actor"`
	ContainerImage  *CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersCommitsListOutputItemsTargetCustomProviderVersionRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionConfigSchema represents the custom providers commits list output items previous custom provider version config schema type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionConfig represents the custom providers commits list output items previous custom provider version config type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionConfig struct {
	// Object - String representing the object's type
	Object string                                                                         `json:"object"`
	Schema CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentCommit represents the custom providers commits list output items previous custom provider version deployment commit type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentCommit struct {
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

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider represents the custom providers commits list output items previous custom provider version deployment immutable bucket scm repo link repository provider type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider struct {
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

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository represents the custom providers commits list output items previous custom provider version deployment immutable bucket scm repo link repository type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                                                   `json:"id"`
	Provider CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLink represents the custom providers commits list output items previous custom provider version deployment immutable bucket scm repo link type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLink struct {
	Object   string `json:"object"`
	IsLinked string `json:"is_linked"`
	// Path - Path within the SCM repository
	Path       *string                                                                                                          `json:"path,omitempty"`
	Repository CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLinkRepository `json:"repository"`
}

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentImmutableBucket represents the custom providers commits list output items previous custom provider version deployment immutable bucket type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentImmutableBucket struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique bucket identifier
	Id string `json:"id"`
	// IsImmutable - Whether the bucket is immutable
	IsImmutable bool `json:"is_immutable"`
	// IsReadOnly - Whether the bucket is read-only
	IsReadOnly  bool                                                                                                    `json:"is_read_only"`
	ScmRepoLink *CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentImmutableBucketScmRepoLink `json:"scm_repo_link,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentActor represents the custom providers commits list output items previous custom provider version deployment actor type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentActor struct {
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

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPushActor represents the custom providers commits list output items previous custom provider version deployment scm push actor type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPushActor struct {
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

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPushCommit represents the custom providers commits list output items previous custom provider version deployment scm push commit type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPushCommit struct {
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

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPushRepositoryProvider represents the custom providers commits list output items previous custom provider version deployment scm push repository provider type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPushRepositoryProvider struct {
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

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPushRepository represents the custom providers commits list output items previous custom provider version deployment scm push repository type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                                `json:"id"`
	Provider CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPush represents the custom providers commits list output items previous custom provider version deployment scm push type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                                                                        `json:"id"`
	Actor      CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPushActor      `json:"actor"`
	Commit     CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPushCommit     `json:"commit"`
	Repository CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeployment represents the custom providers commits list output items previous custom provider version deployment type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeployment struct {
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
	CustomProviderVersionId *string                                                                                      `json:"custom_provider_version_id,omitempty"`
	Commit                  *CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentCommit          `json:"commit,omitempty"`
	ImmutableBucket         *CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentImmutableBucket `json:"immutable_bucket,omitempty"`
	Actor                   CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentActor            `json:"actor"`
	ScmPush                 *CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeploymentScmPush         `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionEnvironmentsEnvironment represents the custom providers commits list output items previous custom provider version environments environment type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionEnvironmentsEnvironment struct {
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

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionEnvironments represents the custom providers commits list output items previous custom provider version environments type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionEnvironments struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Environment version reference identifier
	Id string `json:"id"`
	// IsCurrentVersionForEnvironment - Whether this version is the current one for the environment
	IsCurrentVersionForEnvironment bool                                                                                      `json:"is_current_version_for_environment"`
	Environment                    CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionEnvironmentsEnvironment `json:"environment"`
}

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionActor represents the custom providers commits list output items previous custom provider version actor type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionActor struct {
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

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionContainerImage represents the custom providers commits list output items previous custom provider version container image type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionContainerImage struct {
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionRemoteMcpServer represents the custom providers commits list output items previous custom provider version remote mcp server type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionRemoteMcpServer struct {
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersion represents the custom providers commits list output items previous custom provider version type.
type CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersion struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider version identifier
	Id string `json:"id"`
	// Status - Current version status
	Status string                                                                    `json:"status"`
	Config *CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionConfig `json:"config,omitempty"`
	// Index - Version index number
	Index float64 `json:"index"`
	// Identifier - Version identifier
	Identifier string                                                                       `json:"identifier"`
	Deployment CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionDeployment `json:"deployment"`
	// Environments - Environments this version is deployed to
	Environments []CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionEnvironments `json:"environments"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId      *string                                                                            `json:"provider_id,omitempty"`
	Actor           CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionActor            `json:"actor"`
	ContainerImage  *CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersionRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersCommitsListOutputItemsActor represents the custom providers commits list output items actor type.
type CustomProvidersCommitsListOutputItemsActor struct {
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

// CustomProvidersCommitsListOutputItemsScmPushActor represents the custom providers commits list output items scm push actor type.
type CustomProvidersCommitsListOutputItemsScmPushActor struct {
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

// CustomProvidersCommitsListOutputItemsScmPushCommit represents the custom providers commits list output items scm push commit type.
type CustomProvidersCommitsListOutputItemsScmPushCommit struct {
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

// CustomProvidersCommitsListOutputItemsScmPushRepositoryProvider represents the custom providers commits list output items scm push repository provider type.
type CustomProvidersCommitsListOutputItemsScmPushRepositoryProvider struct {
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

// CustomProvidersCommitsListOutputItemsScmPushRepository represents the custom providers commits list output items scm push repository type.
type CustomProvidersCommitsListOutputItemsScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                         `json:"id"`
	Provider CustomProvidersCommitsListOutputItemsScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsListOutputItemsScmPush represents the custom providers commits list output items scm push type.
type CustomProvidersCommitsListOutputItemsScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                                 `json:"id"`
	Actor      CustomProvidersCommitsListOutputItemsScmPushActor      `json:"actor"`
	Commit     CustomProvidersCommitsListOutputItemsScmPushCommit     `json:"commit"`
	Repository CustomProvidersCommitsListOutputItemsScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersCommitsListOutputItems represents the custom providers commits list output items type.
type CustomProvidersCommitsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider commit identifier
	Id string `json:"id"`
	// Status - Current commit status
	Status string `json:"status"`
	// Trigger - What triggered this commit
	Trigger string                                      `json:"trigger"`
	Error   *CustomProvidersCommitsListOutputItemsError `json:"error,omitempty"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId *string `json:"provider_id,omitempty"`
	// CustomProviderDeploymentId - ID of the associated deployment
	CustomProviderDeploymentId    *string                                                             `json:"custom_provider_deployment_id,omitempty"`
	ToEnvironment                 CustomProvidersCommitsListOutputItemsToEnvironment                  `json:"to_environment"`
	FromEnvironment               *CustomProvidersCommitsListOutputItemsFromEnvironment               `json:"from_environment,omitempty"`
	TargetCustomProviderVersion   CustomProvidersCommitsListOutputItemsTargetCustomProviderVersion    `json:"target_custom_provider_version"`
	PreviousCustomProviderVersion *CustomProvidersCommitsListOutputItemsPreviousCustomProviderVersion `json:"previous_custom_provider_version,omitempty"`
	Actor                         CustomProvidersCommitsListOutputItemsActor                          `json:"actor"`
	ScmPush                       *CustomProvidersCommitsListOutputItemsScmPush                       `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// AppliedAt - Timestamp when the commit was applied
	AppliedAt *time.Time `json:"applied_at,omitempty"`
}

// CustomProvidersCommitsListOutputPagination represents the custom providers commits list output pagination type.
type CustomProvidersCommitsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// CustomProvidersCommitsListOutput represents the custom providers commits list output type.
type CustomProvidersCommitsListOutput struct {
	Items      []CustomProvidersCommitsListOutputItems    `json:"items"`
	Pagination CustomProvidersCommitsListOutputPagination `json:"pagination"`
}

// MapCustomProvidersCommitsListOutputFromJSON deserializes JSON data into a CustomProvidersCommitsListOutput.
func MapCustomProvidersCommitsListOutputFromJSON(data []byte) (*CustomProvidersCommitsListOutput, error) {
	var v CustomProvidersCommitsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersCommitsListOutputToJSON serializes a CustomProvidersCommitsListOutput to JSON.
func MapCustomProvidersCommitsListOutputToJSON(v *CustomProvidersCommitsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CustomProvidersCommitsListQuery represents the custom providers commits list query type.
type CustomProvidersCommitsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by commit IDs
	Id *any `json:"id,omitempty"`
	// CustomProviderVersionId - Filter by version IDs
	CustomProviderVersionId *any `json:"custom_provider_version_id,omitempty"`
	// CustomProviderEnvironmentId - Filter by environment IDs
	CustomProviderEnvironmentId *any `json:"custom_provider_environment_id,omitempty"`
	// CustomProviderId - Filter by custom provider IDs
	CustomProviderId *any `json:"custom_provider_id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
}

// MapCustomProvidersCommitsListQueryFromJSON deserializes JSON data into a CustomProvidersCommitsListQuery.
func MapCustomProvidersCommitsListQueryFromJSON(data []byte) (*CustomProvidersCommitsListQuery, error) {
	var v CustomProvidersCommitsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersCommitsListQueryToJSON serializes a CustomProvidersCommitsListQuery to JSON.
func MapCustomProvidersCommitsListQueryToJSON(v *CustomProvidersCommitsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
