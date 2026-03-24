package deployments

import (
	"encoding/json"
	"time"
)

// CustomProvidersDeploymentsListOutputItemsCommit represents the custom providers deployments list output items commit type.
type CustomProvidersDeploymentsListOutputItemsCommit struct {
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

// CustomProvidersDeploymentsListOutputItemsImmutableBucketScmRepoLinkRepositoryProvider represents the custom providers deployments list output items immutable bucket scm repo link repository provider type.
type CustomProvidersDeploymentsListOutputItemsImmutableBucketScmRepoLinkRepositoryProvider struct {
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

// CustomProvidersDeploymentsListOutputItemsImmutableBucketScmRepoLinkRepository represents the custom providers deployments list output items immutable bucket scm repo link repository type.
type CustomProvidersDeploymentsListOutputItemsImmutableBucketScmRepoLinkRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                                `json:"id"`
	Provider CustomProvidersDeploymentsListOutputItemsImmutableBucketScmRepoLinkRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersDeploymentsListOutputItemsImmutableBucketScmRepoLink represents the custom providers deployments list output items immutable bucket scm repo link type.
type CustomProvidersDeploymentsListOutputItemsImmutableBucketScmRepoLink struct {
	Object   string `json:"object"`
	IsLinked string `json:"is_linked"`
	// Path - Path within the SCM repository
	Path       *string                                                                       `json:"path,omitempty"`
	Repository CustomProvidersDeploymentsListOutputItemsImmutableBucketScmRepoLinkRepository `json:"repository"`
}

// CustomProvidersDeploymentsListOutputItemsImmutableBucket represents the custom providers deployments list output items immutable bucket type.
type CustomProvidersDeploymentsListOutputItemsImmutableBucket struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique bucket identifier
	Id string `json:"id"`
	// IsImmutable - Whether the bucket is immutable
	IsImmutable bool `json:"is_immutable"`
	// IsReadOnly - Whether the bucket is read-only
	IsReadOnly  bool                                                                 `json:"is_read_only"`
	ScmRepoLink *CustomProvidersDeploymentsListOutputItemsImmutableBucketScmRepoLink `json:"scm_repo_link,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersDeploymentsListOutputItemsActor represents the custom providers deployments list output items actor type.
type CustomProvidersDeploymentsListOutputItemsActor struct {
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

// CustomProvidersDeploymentsListOutputItemsScmPushActor represents the custom providers deployments list output items scm push actor type.
type CustomProvidersDeploymentsListOutputItemsScmPushActor struct {
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

// CustomProvidersDeploymentsListOutputItemsScmPushCommit represents the custom providers deployments list output items scm push commit type.
type CustomProvidersDeploymentsListOutputItemsScmPushCommit struct {
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

// CustomProvidersDeploymentsListOutputItemsScmPushRepositoryProvider represents the custom providers deployments list output items scm push repository provider type.
type CustomProvidersDeploymentsListOutputItemsScmPushRepositoryProvider struct {
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

// CustomProvidersDeploymentsListOutputItemsScmPushRepository represents the custom providers deployments list output items scm push repository type.
type CustomProvidersDeploymentsListOutputItemsScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                             `json:"id"`
	Provider CustomProvidersDeploymentsListOutputItemsScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersDeploymentsListOutputItemsScmPush represents the custom providers deployments list output items scm push type.
type CustomProvidersDeploymentsListOutputItemsScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                                     `json:"id"`
	Actor      CustomProvidersDeploymentsListOutputItemsScmPushActor      `json:"actor"`
	Commit     CustomProvidersDeploymentsListOutputItemsScmPushCommit     `json:"commit"`
	Repository CustomProvidersDeploymentsListOutputItemsScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersDeploymentsListOutputItems represents the custom providers deployments list output items type.
type CustomProvidersDeploymentsListOutputItems struct {
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
	CustomProviderVersionId *string                                                   `json:"custom_provider_version_id,omitempty"`
	Commit                  *CustomProvidersDeploymentsListOutputItemsCommit          `json:"commit,omitempty"`
	ImmutableBucket         *CustomProvidersDeploymentsListOutputItemsImmutableBucket `json:"immutable_bucket,omitempty"`
	Actor                   CustomProvidersDeploymentsListOutputItemsActor            `json:"actor"`
	ScmPush                 *CustomProvidersDeploymentsListOutputItemsScmPush         `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomProvidersDeploymentsListOutputPagination represents the custom providers deployments list output pagination type.
type CustomProvidersDeploymentsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// CustomProvidersDeploymentsListOutput represents the custom providers deployments list output type.
type CustomProvidersDeploymentsListOutput struct {
	Items      []CustomProvidersDeploymentsListOutputItems    `json:"items"`
	Pagination CustomProvidersDeploymentsListOutputPagination `json:"pagination"`
}

// MapCustomProvidersDeploymentsListOutputFromJSON deserializes JSON data into a CustomProvidersDeploymentsListOutput.
func MapCustomProvidersDeploymentsListOutputFromJSON(data []byte) (*CustomProvidersDeploymentsListOutput, error) {
	var v CustomProvidersDeploymentsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersDeploymentsListOutputToJSON serializes a CustomProvidersDeploymentsListOutput to JSON.
func MapCustomProvidersDeploymentsListOutputToJSON(v *CustomProvidersDeploymentsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// CustomProvidersDeploymentsListQuery represents the custom providers deployments list query type.
type CustomProvidersDeploymentsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by status (queued, deploying, succeeded, failed)
	Status *any `json:"status,omitempty"`
	// Id - Filter by deployment IDs
	Id *any `json:"id,omitempty"`
	// CustomProviderVersionId - Filter by version IDs
	CustomProviderVersionId *any `json:"custom_provider_version_id,omitempty"`
	// CustomProviderId - Filter by custom provider IDs
	CustomProviderId *any `json:"custom_provider_id,omitempty"`
}

// MapCustomProvidersDeploymentsListQueryFromJSON deserializes JSON data into a CustomProvidersDeploymentsListQuery.
func MapCustomProvidersDeploymentsListQueryFromJSON(data []byte) (*CustomProvidersDeploymentsListQuery, error) {
	var v CustomProvidersDeploymentsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersDeploymentsListQueryToJSON serializes a CustomProvidersDeploymentsListQuery to JSON.
func MapCustomProvidersDeploymentsListQueryToJSON(v *CustomProvidersDeploymentsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
