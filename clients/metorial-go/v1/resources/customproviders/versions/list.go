package versions

import (
	"encoding/json"
	"time"
)

// CustomProvidersVersionsListOutputItemsConfigSchema represents the custom providers versions list output items config schema type.
type CustomProvidersVersionsListOutputItemsConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersVersionsListOutputItemsConfig represents the custom providers versions list output items config type.
type CustomProvidersVersionsListOutputItemsConfig struct {
	// Object - String representing the object's type
	Object string                                             `json:"object"`
	Schema CustomProvidersVersionsListOutputItemsConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersVersionsListOutputItemsDeploymentCommit represents the custom providers versions list output items deployment commit type.
type CustomProvidersVersionsListOutputItemsDeploymentCommit struct {
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

// CustomProvidersVersionsListOutputItemsDeploymentImmutableBucketScmRepoLinkRepositoryProvider represents the custom providers versions list output items deployment immutable bucket scm repo link repository provider type.
type CustomProvidersVersionsListOutputItemsDeploymentImmutableBucketScmRepoLinkRepositoryProvider struct {
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

// CustomProvidersVersionsListOutputItemsDeploymentImmutableBucketScmRepoLinkRepository represents the custom providers versions list output items deployment immutable bucket scm repo link repository type.
type CustomProvidersVersionsListOutputItemsDeploymentImmutableBucketScmRepoLinkRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                       `json:"id"`
	Provider CustomProvidersVersionsListOutputItemsDeploymentImmutableBucketScmRepoLinkRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsListOutputItemsDeploymentImmutableBucketScmRepoLink represents the custom providers versions list output items deployment immutable bucket scm repo link type.
type CustomProvidersVersionsListOutputItemsDeploymentImmutableBucketScmRepoLink struct {
	Object   string `json:"object"`
	IsLinked string `json:"is_linked"`
	// Path - Path within the SCM repository
	Path       *string                                                                              `json:"path,omitempty"`
	Repository CustomProvidersVersionsListOutputItemsDeploymentImmutableBucketScmRepoLinkRepository `json:"repository"`
}

// CustomProvidersVersionsListOutputItemsDeploymentImmutableBucket represents the custom providers versions list output items deployment immutable bucket type.
type CustomProvidersVersionsListOutputItemsDeploymentImmutableBucket struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique bucket identifier
	Id string `json:"id"`
	// IsImmutable - Whether the bucket is immutable
	IsImmutable bool `json:"is_immutable"`
	// IsReadOnly - Whether the bucket is read-only
	IsReadOnly  bool                                                                        `json:"is_read_only"`
	ScmRepoLink *CustomProvidersVersionsListOutputItemsDeploymentImmutableBucketScmRepoLink `json:"scm_repo_link,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsListOutputItemsDeploymentActor represents the custom providers versions list output items deployment actor type.
type CustomProvidersVersionsListOutputItemsDeploymentActor struct {
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

// CustomProvidersVersionsListOutputItemsDeploymentScmPushActor represents the custom providers versions list output items deployment scm push actor type.
type CustomProvidersVersionsListOutputItemsDeploymentScmPushActor struct {
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

// CustomProvidersVersionsListOutputItemsDeploymentScmPushCommit represents the custom providers versions list output items deployment scm push commit type.
type CustomProvidersVersionsListOutputItemsDeploymentScmPushCommit struct {
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

// CustomProvidersVersionsListOutputItemsDeploymentScmPushRepositoryProvider represents the custom providers versions list output items deployment scm push repository provider type.
type CustomProvidersVersionsListOutputItemsDeploymentScmPushRepositoryProvider struct {
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

// CustomProvidersVersionsListOutputItemsDeploymentScmPushRepository represents the custom providers versions list output items deployment scm push repository type.
type CustomProvidersVersionsListOutputItemsDeploymentScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                    `json:"id"`
	Provider CustomProvidersVersionsListOutputItemsDeploymentScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsListOutputItemsDeploymentScmPush represents the custom providers versions list output items deployment scm push type.
type CustomProvidersVersionsListOutputItemsDeploymentScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                                            `json:"id"`
	Actor      CustomProvidersVersionsListOutputItemsDeploymentScmPushActor      `json:"actor"`
	Commit     CustomProvidersVersionsListOutputItemsDeploymentScmPushCommit     `json:"commit"`
	Repository CustomProvidersVersionsListOutputItemsDeploymentScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsListOutputItemsDeployment represents the custom providers versions list output items deployment type.
type CustomProvidersVersionsListOutputItemsDeployment struct {
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
	CustomProviderVersionId *string                                                          `json:"custom_provider_version_id,omitempty"`
	Commit                  *CustomProvidersVersionsListOutputItemsDeploymentCommit          `json:"commit,omitempty"`
	ImmutableBucket         *CustomProvidersVersionsListOutputItemsDeploymentImmutableBucket `json:"immutable_bucket,omitempty"`
	Actor                   CustomProvidersVersionsListOutputItemsDeploymentActor            `json:"actor"`
	ScmPush                 *CustomProvidersVersionsListOutputItemsDeploymentScmPush         `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersVersionsListOutputItemsEnvironmentsEnvironment represents the custom providers versions list output items environments environment type.
type CustomProvidersVersionsListOutputItemsEnvironmentsEnvironment struct {
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

// CustomProvidersVersionsListOutputItemsEnvironments represents the custom providers versions list output items environments type.
type CustomProvidersVersionsListOutputItemsEnvironments struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Environment version reference identifier
	Id string `json:"id"`
	// IsCurrentVersionForEnvironment - Whether this version is the current one for the environment
	IsCurrentVersionForEnvironment bool                                                          `json:"is_current_version_for_environment"`
	Environment                    CustomProvidersVersionsListOutputItemsEnvironmentsEnvironment `json:"environment"`
}

// CustomProvidersVersionsListOutputItemsActor represents the custom providers versions list output items actor type.
type CustomProvidersVersionsListOutputItemsActor struct {
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

// CustomProvidersVersionsListOutputItemsContainerImage represents the custom providers versions list output items container image type.
type CustomProvidersVersionsListOutputItemsContainerImage struct {
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersVersionsListOutputItemsRemoteMcpServer represents the custom providers versions list output items remote mcp server type.
type CustomProvidersVersionsListOutputItemsRemoteMcpServer struct {
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersVersionsListOutputItems represents the custom providers versions list output items type.
type CustomProvidersVersionsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider version identifier
	Id string `json:"id"`
	// Status - Current version status
	Status string                                        `json:"status"`
	Config *CustomProvidersVersionsListOutputItemsConfig `json:"config,omitempty"`
	// Index - Version index number
	Index float64 `json:"index"`
	// Identifier - Version identifier
	Identifier string                                           `json:"identifier"`
	Deployment CustomProvidersVersionsListOutputItemsDeployment `json:"deployment"`
	// Environments - Environments this version is deployed to
	Environments []CustomProvidersVersionsListOutputItemsEnvironments `json:"environments"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId      *string                                                `json:"provider_id,omitempty"`
	Actor           CustomProvidersVersionsListOutputItemsActor            `json:"actor"`
	ContainerImage  *CustomProvidersVersionsListOutputItemsContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersVersionsListOutputItemsRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersVersionsListOutputPagination represents the custom providers versions list output pagination type.
type CustomProvidersVersionsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// CustomProvidersVersionsListOutput represents the custom providers versions list output type.
type CustomProvidersVersionsListOutput struct {
	Items      []CustomProvidersVersionsListOutputItems    `json:"items"`
	Pagination CustomProvidersVersionsListOutputPagination `json:"pagination"`
}

// MapCustomProvidersVersionsListOutputFromJSON deserializes JSON data into a CustomProvidersVersionsListOutput.
func MapCustomProvidersVersionsListOutputFromJSON(data []byte) (*CustomProvidersVersionsListOutput, error) {
	var v CustomProvidersVersionsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersVersionsListOutputToJSON serializes a CustomProvidersVersionsListOutput to JSON.
func MapCustomProvidersVersionsListOutputToJSON(v *CustomProvidersVersionsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CustomProvidersVersionsListQuery represents the custom providers versions list query type.
type CustomProvidersVersionsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by deployment status
	Status *any `json:"status,omitempty"`
	// Id - Filter by version ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider IDs (matches providers connected to sessions)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderVersionId - Filter by provider version IDs (matches providers connected to sessions)
	ProviderVersionId *any `json:"provider_version_id,omitempty"`
	// CustomProviderId - Filter by custom provider IDs (matches providers connected to sessions)
	CustomProviderId *any `json:"custom_provider_id,omitempty"`
	// CustomProviderDeploymentId - Filter by custom provider deployment IDs (matches providers connected to sessions)
	CustomProviderDeploymentId *any `json:"custom_provider_deployment_id,omitempty"`
	// CustomProviderEnvironmentId - Filter by custom provider environment IDs (matches providers connected to sessions)
	CustomProviderEnvironmentId *any `json:"custom_provider_environment_id,omitempty"`
}

// MapCustomProvidersVersionsListQueryFromJSON deserializes JSON data into a CustomProvidersVersionsListQuery.
func MapCustomProvidersVersionsListQueryFromJSON(data []byte) (*CustomProvidersVersionsListQuery, error) {
	var v CustomProvidersVersionsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersVersionsListQueryToJSON serializes a CustomProvidersVersionsListQuery to JSON.
func MapCustomProvidersVersionsListQueryToJSON(v *CustomProvidersVersionsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
