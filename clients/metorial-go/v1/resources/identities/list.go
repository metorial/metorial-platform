package identities

import (
	"encoding/json"
	"time"
)

// IdentitiesListOutputItemsOwnerActor represents the identities list output items owner actor type.
type IdentitiesListOutputItemsOwnerActor struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique identity actor identifier.
	Id string `json:"id"`
	// Type - Type of actor that owns or participates in identities.
	Type string `json:"type"`
	// Status - Current lifecycle status of the identity actor.
	Status string `json:"status"`
	// Name - Human-readable name of the identity actor.
	Name string `json:"name"`
	// Description - Optional description of the actor.
	Description *string `json:"description,omitempty"`
	// Metadata - Additional metadata associated with the actor.
	Metadata *map[string]any `json:"metadata,omitempty"`
	// AgentId - Linked agent identifier when this actor represents an agent.
	AgentId *string `json:"agent_id,omitempty"`
	// CreatedAt - Timestamp when the actor was created.
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the actor was last updated.
	UpdatedAt time.Time `json:"updated_at"`
}

// IdentitiesListOutputItemsOwner represents the identities list output items owner type.
type IdentitiesListOutputItemsOwner struct {
	// Type - Owner type for the identity.
	Type  string                              `json:"type"`
	Actor IdentitiesListOutputItemsOwnerActor `json:"actor"`
}

// IdentitiesListOutputItemsCredentials represents the identities list output items credentials type.
type IdentitiesListOutputItemsCredentials struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique identity credential identifier.
	Id string `json:"id"`
	// Status - Current lifecycle status of the credential.
	Status string `json:"status"`
	// IdentityId - Identity that owns this credential.
	IdentityId string `json:"identity_id"`
	// ProviderId - Provider associated with the credential.
	ProviderId string `json:"provider_id"`
	// DeploymentId - Provider deployment used by this credential.
	DeploymentId *string `json:"deployment_id,omitempty"`
	// ConfigId - Provider config used by this credential.
	ConfigId *string `json:"config_id,omitempty"`
	// AuthConfigId - Provider auth config used by this credential.
	AuthConfigId *string `json:"auth_config_id,omitempty"`
	// DelegationConfigId - Delegation config applied to this credential.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// CreatedAt - Timestamp when the credential was created.
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the credential was last updated.
	UpdatedAt time.Time `json:"updated_at"`
}

// IdentitiesListOutputItems represents the identities list output items type.
type IdentitiesListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique identity identifier.
	Id string `json:"id"`
	// Status - Current lifecycle status of the identity.
	Status string `json:"status"`
	// Name - Human-readable name of the identity.
	Name *string `json:"name,omitempty"`
	// Description - Optional description of what the identity is used for.
	Description *string `json:"description,omitempty"`
	// Metadata - Additional metadata associated with the identity.
	Metadata *map[string]any                `json:"metadata,omitempty"`
	Owner    IdentitiesListOutputItemsOwner `json:"owner"`
	// Credentials - Credentials currently attached to the identity.
	Credentials []IdentitiesListOutputItemsCredentials `json:"credentials"`
	// DelegationConfigId - Default delegation config applied to the identity.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// CreatedAt - Timestamp when the identity was created.
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the identity was last updated.
	UpdatedAt time.Time `json:"updated_at"`
}

// IdentitiesListOutputPagination represents the identities list output pagination type.
type IdentitiesListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// IdentitiesListOutput represents the identities list output type.
type IdentitiesListOutput struct {
	Items      []IdentitiesListOutputItems    `json:"items"`
	Pagination IdentitiesListOutputPagination `json:"pagination"`
}

// MapIdentitiesListOutputFromJSON deserializes JSON data into a IdentitiesListOutput.
func MapIdentitiesListOutputFromJSON(data []byte) (*IdentitiesListOutput, error) {
	var v IdentitiesListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesListOutputToJSON serializes a IdentitiesListOutput to JSON.
func MapIdentitiesListOutputToJSON(v *IdentitiesListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesListQuery represents the identities list query type.
type IdentitiesListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Search - Filter identities by name or description.
	Search *string `json:"search,omitempty"`
	// Status - Filter by one or more identity statuses.
	Status *any `json:"status,omitempty"`
	// Id - Filter by identity ID or IDs.
	Id *any `json:"id,omitempty"`
	// AgentId - Filter by owner agent ID or IDs.
	AgentId *any `json:"agent_id,omitempty"`
	// ActorId - Filter by owner identity actor ID or IDs.
	ActorId *any `json:"actor_id,omitempty"`
}

// MapIdentitiesListQueryFromJSON deserializes JSON data into a IdentitiesListQuery.
func MapIdentitiesListQueryFromJSON(data []byte) (*IdentitiesListQuery, error) {
	var v IdentitiesListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesListQueryToJSON serializes a IdentitiesListQuery to JSON.
func MapIdentitiesListQueryToJSON(v *IdentitiesListQuery) ([]byte, error) {
	return json.Marshal(v)
}
