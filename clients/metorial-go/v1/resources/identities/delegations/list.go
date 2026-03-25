package delegations

import (
	"encoding/json"
	"time"
)

// IdentitiesDelegationsListOutputItemsAttestation represents the identities delegations list output items attestation type.
type IdentitiesDelegationsListOutputItemsAttestation struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique attestation identifier.
	Id string `json:"id"`
	// Type - Type of attestation, if any.
	Type string `json:"type"`
	// CreatedAt - Timestamp when the attestation was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationsListOutputItemsIdentity represents the identities delegations list output items identity type.
type IdentitiesDelegationsListOutputItemsIdentity struct {
	// Object - String representing the identity object's type
	Object string `json:"object"`
	// Id - Unique identity identifier.
	Id string `json:"id"`
	// Name - Display name of the identity.
	Name string `json:"name"`
	// Description - Optional description of the identity.
	Description string `json:"description"`
	// Metadata - Additional metadata associated with the identity.
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// IdentitiesDelegationsListOutputItemsPartiesActor represents the identities delegations list output items parties actor type.
type IdentitiesDelegationsListOutputItemsPartiesActor struct {
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

// IdentitiesDelegationsListOutputItemsParties represents the identities delegations list output items parties type.
type IdentitiesDelegationsListOutputItemsParties struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation party identifier.
	Id string `json:"id"`
	// Roles - Roles this actor has in the delegation.
	Roles []string                                         `json:"roles"`
	Actor IdentitiesDelegationsListOutputItemsPartiesActor `json:"actor"`
	// CreatedAt - Timestamp when the party was attached to the delegation.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationsListOutputItemsRequestRequester represents the identities delegations list output items request requester type.
type IdentitiesDelegationsListOutputItemsRequestRequester struct {
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

// IdentitiesDelegationsListOutputItemsRequest represents the identities delegations list output items request type.
type IdentitiesDelegationsListOutputItemsRequest struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation request identifier.
	Id string `json:"id"`
	// Status - Current status of the related delegation request.
	Status string `json:"status"`
	// DeniedReason - Reason the request was denied, if applicable.
	DeniedReason *string                                              `json:"denied_reason,omitempty"`
	Requester    IdentitiesDelegationsListOutputItemsRequestRequester `json:"requester"`
	// IdentityId - Identity targeted by the request.
	IdentityId string `json:"identity_id"`
	// ExpiresAt - Timestamp when the request expires.
	ExpiresAt time.Time `json:"expires_at"`
	// CreatedAt - Timestamp when the request was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationsListOutputItemsCredentialOverrides represents the identities delegations list output items credential overrides type.
type IdentitiesDelegationsListOutputItemsCredentialOverrides struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique credential override identifier.
	Id string `json:"id"`
	// Status - Current status of the credential override.
	Status string `json:"status"`
	// Permissions - Permissions granted for this credential override.
	Permissions []string `json:"permissions"`
	// CredentialId - Credential receiving the override.
	CredentialId string `json:"credential_id"`
	// CreatedAt - Timestamp when the credential override was created.
	CreatedAt time.Time `json:"created_at"`
	// ExpiresAt - Timestamp when the credential override expires, if set.
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// IdentitiesDelegationsListOutputItems represents the identities delegations list output items type.
type IdentitiesDelegationsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation identifier.
	Id string `json:"id"`
	// Status - Current status of the delegation.
	Status string `json:"status"`
	// DeniedReason - Reason the delegation was denied, if applicable.
	DeniedReason *string `json:"denied_reason,omitempty"`
	// DelegationLevel - Depth level of this delegation in the delegation chain.
	DelegationLevel float64 `json:"delegation_level"`
	// Permissions - Permissions granted by this delegation.
	Permissions []string                                         `json:"permissions"`
	Attestation *IdentitiesDelegationsListOutputItemsAttestation `json:"attestation,omitempty"`
	// Note - Optional note explaining the delegation.
	Note *string `json:"note,omitempty"`
	// Metadata - Additional metadata associated with the delegation.
	Metadata *map[string]any                              `json:"metadata,omitempty"`
	Identity IdentitiesDelegationsListOutputItemsIdentity `json:"identity"`
	// DelegationConfigId - Delegation config used to evaluate this delegation.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// Parties - Actors involved in the delegation and their roles.
	Parties []IdentitiesDelegationsListOutputItemsParties `json:"parties"`
	Request *IdentitiesDelegationsListOutputItemsRequest  `json:"request,omitempty"`
	// CredentialOverrides - Per-credential permission overrides attached to the delegation.
	CredentialOverrides []IdentitiesDelegationsListOutputItemsCredentialOverrides `json:"credential_overrides"`
	// CreatedAt - Timestamp when the delegation was created.
	CreatedAt time.Time `json:"created_at"`
	// ExpiresAt - Timestamp when the delegation expires, if set.
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	// RevokedAt - Timestamp when the delegation was revoked, if revoked.
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
}

// IdentitiesDelegationsListOutputPagination represents the identities delegations list output pagination type.
type IdentitiesDelegationsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// IdentitiesDelegationsListOutput represents the identities delegations list output type.
type IdentitiesDelegationsListOutput struct {
	Items      []IdentitiesDelegationsListOutputItems    `json:"items"`
	Pagination IdentitiesDelegationsListOutputPagination `json:"pagination"`
}

// MapIdentitiesDelegationsListOutputFromJSON deserializes JSON data into a IdentitiesDelegationsListOutput.
func MapIdentitiesDelegationsListOutputFromJSON(data []byte) (*IdentitiesDelegationsListOutput, error) {
	var v IdentitiesDelegationsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationsListOutputToJSON serializes a IdentitiesDelegationsListOutput to JSON.
func MapIdentitiesDelegationsListOutputToJSON(v *IdentitiesDelegationsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesDelegationsListQuery represents the identities delegations list query type.
type IdentitiesDelegationsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by one or more delegation statuses.
	Status *any `json:"status,omitempty"`
	// Permissions - Filter by one or more granted permissions.
	Permissions *any `json:"permissions,omitempty"`
	// Id - Filter by delegation ID or IDs.
	Id *any `json:"id,omitempty"`
	// OwnerActorId - Filter by owner actor ID or IDs.
	OwnerActorId *any `json:"owner_actor_id,omitempty"`
	// DelegatorActorId - Filter by delegator actor ID or IDs.
	DelegatorActorId *any `json:"delegator_actor_id,omitempty"`
	// DelegateeActorId - Filter by delegatee actor ID or IDs.
	DelegateeActorId *any `json:"delegatee_actor_id,omitempty"`
	// IdentityId - Filter by identity ID or IDs.
	IdentityId *any `json:"identity_id,omitempty"`
}

// MapIdentitiesDelegationsListQueryFromJSON deserializes JSON data into a IdentitiesDelegationsListQuery.
func MapIdentitiesDelegationsListQueryFromJSON(data []byte) (*IdentitiesDelegationsListQuery, error) {
	var v IdentitiesDelegationsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationsListQueryToJSON serializes a IdentitiesDelegationsListQuery to JSON.
func MapIdentitiesDelegationsListQueryToJSON(v *IdentitiesDelegationsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
