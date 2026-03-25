package versions

import (
	"encoding/json"
	"time"
)

// CustomProvidersVersionsGetOutputConfigSchema represents the custom providers versions get output config schema type.
type CustomProvidersVersionsGetOutputConfigSchema struct {
	Type string `json:"type"`
	// Schema - JSON Schema defining the configuration fields for the custom provider
	Schema map[string]any `json:"schema"`
}

// CustomProvidersVersionsGetOutputConfig represents the custom providers versions get output config type.
type CustomProvidersVersionsGetOutputConfig struct {
	// Object - String representing the object's type
	Object string                                       `json:"object"`
	Schema CustomProvidersVersionsGetOutputConfigSchema `json:"schema"`
	// Transformer - Optional jsonata transformer function for the configuration.
	Transformer string `json:"transformer"`
}

// CustomProvidersVersionsGetOutputDeploymentCommit represents the custom providers versions get output deployment commit type.
type CustomProvidersVersionsGetOutputDeploymentCommit struct {
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

// CustomProvidersVersionsGetOutputDeploymentImmutableBucketScmRepoLinkRepositoryProvider represents the custom providers versions get output deployment immutable bucket scm repo link repository provider type.
type CustomProvidersVersionsGetOutputDeploymentImmutableBucketScmRepoLinkRepositoryProvider struct {
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

// CustomProvidersVersionsGetOutputDeploymentImmutableBucketScmRepoLinkRepository represents the custom providers versions get output deployment immutable bucket scm repo link repository type.
type CustomProvidersVersionsGetOutputDeploymentImmutableBucketScmRepoLinkRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                 `json:"id"`
	Provider CustomProvidersVersionsGetOutputDeploymentImmutableBucketScmRepoLinkRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsGetOutputDeploymentImmutableBucketScmRepoLink represents the custom providers versions get output deployment immutable bucket scm repo link type.
type CustomProvidersVersionsGetOutputDeploymentImmutableBucketScmRepoLink struct {
	Object   string `json:"object"`
	IsLinked string `json:"is_linked"`
	// Path - Path within the SCM repository
	Path       *string                                                                        `json:"path,omitempty"`
	Repository CustomProvidersVersionsGetOutputDeploymentImmutableBucketScmRepoLinkRepository `json:"repository"`
}

// CustomProvidersVersionsGetOutputDeploymentImmutableBucket represents the custom providers versions get output deployment immutable bucket type.
type CustomProvidersVersionsGetOutputDeploymentImmutableBucket struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique bucket identifier
	Id string `json:"id"`
	// IsImmutable - Whether the bucket is immutable
	IsImmutable bool `json:"is_immutable"`
	// IsReadOnly - Whether the bucket is read-only
	IsReadOnly  bool                                                                  `json:"is_read_only"`
	ScmRepoLink *CustomProvidersVersionsGetOutputDeploymentImmutableBucketScmRepoLink `json:"scm_repo_link,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsGetOutputDeploymentActor represents the custom providers versions get output deployment actor type.
type CustomProvidersVersionsGetOutputDeploymentActor struct {
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

// CustomProvidersVersionsGetOutputDeploymentScmPushActor represents the custom providers versions get output deployment scm push actor type.
type CustomProvidersVersionsGetOutputDeploymentScmPushActor struct {
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

// CustomProvidersVersionsGetOutputDeploymentScmPushCommit represents the custom providers versions get output deployment scm push commit type.
type CustomProvidersVersionsGetOutputDeploymentScmPushCommit struct {
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

// CustomProvidersVersionsGetOutputDeploymentScmPushRepositoryProvider represents the custom providers versions get output deployment scm push repository provider type.
type CustomProvidersVersionsGetOutputDeploymentScmPushRepositoryProvider struct {
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

// CustomProvidersVersionsGetOutputDeploymentScmPushRepository represents the custom providers versions get output deployment scm push repository type.
type CustomProvidersVersionsGetOutputDeploymentScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                              `json:"id"`
	Provider CustomProvidersVersionsGetOutputDeploymentScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsGetOutputDeploymentScmPush represents the custom providers versions get output deployment scm push type.
type CustomProvidersVersionsGetOutputDeploymentScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                                      `json:"id"`
	Actor      CustomProvidersVersionsGetOutputDeploymentScmPushActor      `json:"actor"`
	Commit     CustomProvidersVersionsGetOutputDeploymentScmPushCommit     `json:"commit"`
	Repository CustomProvidersVersionsGetOutputDeploymentScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersVersionsGetOutputDeployment represents the custom providers versions get output deployment type.
type CustomProvidersVersionsGetOutputDeployment struct {
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
	CustomProviderVersionId *string                                                    `json:"custom_provider_version_id,omitempty"`
	Commit                  *CustomProvidersVersionsGetOutputDeploymentCommit          `json:"commit,omitempty"`
	ImmutableBucket         *CustomProvidersVersionsGetOutputDeploymentImmutableBucket `json:"immutable_bucket,omitempty"`
	Actor                   CustomProvidersVersionsGetOutputDeploymentActor            `json:"actor"`
	ScmPush                 *CustomProvidersVersionsGetOutputDeploymentScmPush         `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersVersionsGetOutputEnvironmentsEnvironment represents the custom providers versions get output environments environment type.
type CustomProvidersVersionsGetOutputEnvironmentsEnvironment struct {
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

// CustomProvidersVersionsGetOutputEnvironments represents the custom providers versions get output environments type.
type CustomProvidersVersionsGetOutputEnvironments struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Environment version reference identifier
	Id string `json:"id"`
	// IsCurrentVersionForEnvironment - Whether this version is the current one for the environment
	IsCurrentVersionForEnvironment bool                                                    `json:"is_current_version_for_environment"`
	Environment                    CustomProvidersVersionsGetOutputEnvironmentsEnvironment `json:"environment"`
}

// CustomProvidersVersionsGetOutputActor represents the custom providers versions get output actor type.
type CustomProvidersVersionsGetOutputActor struct {
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

// CustomProvidersVersionsGetOutputContainerImage represents the custom providers versions get output container image type.
type CustomProvidersVersionsGetOutputContainerImage struct {
	// ContainerRegistry - URL of the container registry
	ContainerRegistry string `json:"container_registry"`
	// ContainerImageTag - Tag of the container image
	ContainerImageTag string `json:"container_image_tag"`
	// ContainerImage - Name of the container image
	ContainerImage string `json:"container_image"`
}

// CustomProvidersVersionsGetOutputRemoteMcpServer represents the custom providers versions get output remote mcp server type.
type CustomProvidersVersionsGetOutputRemoteMcpServer struct {
	// Url - URL of the remote MCP server
	Url string `json:"url"`
	// Transport - Transport protocol for the remote MCP server
	Transport string `json:"transport"`
}

// CustomProvidersVersionsGetOutput represents the custom providers versions get output type.
type CustomProvidersVersionsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique custom provider version identifier
	Id string `json:"id"`
	// Status - Current version status
	Status string                                  `json:"status"`
	Config *CustomProvidersVersionsGetOutputConfig `json:"config,omitempty"`
	// Index - Version index number
	Index float64 `json:"index"`
	// Identifier - Version identifier
	Identifier string                                     `json:"identifier"`
	Deployment CustomProvidersVersionsGetOutputDeployment `json:"deployment"`
	// Environments - Environments this version is deployed to
	Environments []CustomProvidersVersionsGetOutputEnvironments `json:"environments"`
	// CustomProviderId - ID of the parent custom provider
	CustomProviderId string `json:"custom_provider_id"`
	// ProviderId - ID of the associated provider
	ProviderId      *string                                          `json:"provider_id,omitempty"`
	Actor           CustomProvidersVersionsGetOutputActor            `json:"actor"`
	ContainerImage  *CustomProvidersVersionsGetOutputContainerImage  `json:"container_image,omitempty"`
	RemoteMcpServer *CustomProvidersVersionsGetOutputRemoteMcpServer `json:"remote_mcp_server,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCustomProvidersVersionsGetOutputFromJSON deserializes JSON data into a CustomProvidersVersionsGetOutput.
func MapCustomProvidersVersionsGetOutputFromJSON(data []byte) (*CustomProvidersVersionsGetOutput, error) {
	var v CustomProvidersVersionsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersVersionsGetOutputToJSON serializes a CustomProvidersVersionsGetOutput to JSON.
func MapCustomProvidersVersionsGetOutputToJSON(v *CustomProvidersVersionsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
