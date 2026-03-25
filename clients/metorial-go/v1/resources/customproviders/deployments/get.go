package deployments

import (
	"encoding/json"
	"time"
)

// CustomProvidersDeploymentsGetOutputCommit represents the custom providers deployments get output commit type.
type CustomProvidersDeploymentsGetOutputCommit struct {
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

// CustomProvidersDeploymentsGetOutputImmutableBucketScmRepoLinkRepositoryProvider represents the custom providers deployments get output immutable bucket scm repo link repository provider type.
type CustomProvidersDeploymentsGetOutputImmutableBucketScmRepoLinkRepositoryProvider struct {
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

// CustomProvidersDeploymentsGetOutputImmutableBucketScmRepoLinkRepository represents the custom providers deployments get output immutable bucket scm repo link repository type.
type CustomProvidersDeploymentsGetOutputImmutableBucketScmRepoLinkRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                                          `json:"id"`
	Provider CustomProvidersDeploymentsGetOutputImmutableBucketScmRepoLinkRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersDeploymentsGetOutputImmutableBucketScmRepoLink represents the custom providers deployments get output immutable bucket scm repo link type.
type CustomProvidersDeploymentsGetOutputImmutableBucketScmRepoLink struct {
	Object   string `json:"object"`
	IsLinked string `json:"is_linked"`
	// Path - Path within the SCM repository
	Path       *string                                                                 `json:"path,omitempty"`
	Repository CustomProvidersDeploymentsGetOutputImmutableBucketScmRepoLinkRepository `json:"repository"`
}

// CustomProvidersDeploymentsGetOutputImmutableBucket represents the custom providers deployments get output immutable bucket type.
type CustomProvidersDeploymentsGetOutputImmutableBucket struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique bucket identifier
	Id string `json:"id"`
	// IsImmutable - Whether the bucket is immutable
	IsImmutable bool `json:"is_immutable"`
	// IsReadOnly - Whether the bucket is read-only
	IsReadOnly  bool                                                           `json:"is_read_only"`
	ScmRepoLink *CustomProvidersDeploymentsGetOutputImmutableBucketScmRepoLink `json:"scm_repo_link,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersDeploymentsGetOutputActor represents the custom providers deployments get output actor type.
type CustomProvidersDeploymentsGetOutputActor struct {
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

// CustomProvidersDeploymentsGetOutputScmPushActor represents the custom providers deployments get output scm push actor type.
type CustomProvidersDeploymentsGetOutputScmPushActor struct {
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

// CustomProvidersDeploymentsGetOutputScmPushCommit represents the custom providers deployments get output scm push commit type.
type CustomProvidersDeploymentsGetOutputScmPushCommit struct {
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

// CustomProvidersDeploymentsGetOutputScmPushRepositoryProvider represents the custom providers deployments get output scm push repository provider type.
type CustomProvidersDeploymentsGetOutputScmPushRepositoryProvider struct {
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

// CustomProvidersDeploymentsGetOutputScmPushRepository represents the custom providers deployments get output scm push repository type.
type CustomProvidersDeploymentsGetOutputScmPushRepository struct {
	Object string `json:"object"`
	// Id - Unique repository identifier
	Id       string                                                       `json:"id"`
	Provider CustomProvidersDeploymentsGetOutputScmPushRepositoryProvider `json:"provider"`
	// Url - Repository URL
	Url string `json:"url"`
	// IsPrivate - Whether the repository is private
	IsPrivate bool `json:"is_private"`
	// DefaultBranch - Default branch name
	DefaultBranch string `json:"default_branch"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersDeploymentsGetOutputScmPush represents the custom providers deployments get output scm push type.
type CustomProvidersDeploymentsGetOutputScmPush struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique SCM push identifier
	Id         string                                               `json:"id"`
	Actor      CustomProvidersDeploymentsGetOutputScmPushActor      `json:"actor"`
	Commit     CustomProvidersDeploymentsGetOutputScmPushCommit     `json:"commit"`
	Repository CustomProvidersDeploymentsGetOutputScmPushRepository `json:"repository"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
}

// CustomProvidersDeploymentsGetOutput represents the custom providers deployments get output type.
type CustomProvidersDeploymentsGetOutput struct {
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
	CustomProviderVersionId *string                                             `json:"custom_provider_version_id,omitempty"`
	Commit                  *CustomProvidersDeploymentsGetOutputCommit          `json:"commit,omitempty"`
	ImmutableBucket         *CustomProvidersDeploymentsGetOutputImmutableBucket `json:"immutable_bucket,omitempty"`
	Actor                   CustomProvidersDeploymentsGetOutputActor            `json:"actor"`
	ScmPush                 *CustomProvidersDeploymentsGetOutputScmPush         `json:"scm_push,omitempty"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapCustomProvidersDeploymentsGetOutputFromJSON deserializes JSON data into a CustomProvidersDeploymentsGetOutput.
func MapCustomProvidersDeploymentsGetOutputFromJSON(data []byte) (*CustomProvidersDeploymentsGetOutput, error) {
	var v CustomProvidersDeploymentsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapCustomProvidersDeploymentsGetOutputToJSON serializes a CustomProvidersDeploymentsGetOutput to JSON.
func MapCustomProvidersDeploymentsGetOutputToJSON(v *CustomProvidersDeploymentsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
