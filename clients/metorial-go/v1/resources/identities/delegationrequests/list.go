package delegationrequests

import (
	"encoding/json"
	"time"
)

// IdentitiesDelegationRequestsListOutputItemsRequester represents the identities delegation requests list output items requester type.
type IdentitiesDelegationRequestsListOutputItemsRequester struct {
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

// IdentitiesDelegationRequestsListOutputItemsDelegationAttestation represents the identities delegation requests list output items delegation attestation type.
type IdentitiesDelegationRequestsListOutputItemsDelegationAttestation struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique attestation identifier.
	Id string `json:"id"`
	// Type - Type of attestation, if any.
	Type string `json:"type"`
	// CreatedAt - Timestamp when the attestation was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationRequestsListOutputItemsDelegationIdentity represents the identities delegation requests list output items delegation identity type.
type IdentitiesDelegationRequestsListOutputItemsDelegationIdentity struct {
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

// IdentitiesDelegationRequestsListOutputItemsDelegationPartiesActor represents the identities delegation requests list output items delegation parties actor type.
type IdentitiesDelegationRequestsListOutputItemsDelegationPartiesActor struct {
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

// IdentitiesDelegationRequestsListOutputItemsDelegationParties represents the identities delegation requests list output items delegation parties type.
type IdentitiesDelegationRequestsListOutputItemsDelegationParties struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation party identifier.
	Id string `json:"id"`
	// Roles - Roles this actor has in the delegation.
	Roles []string                                                          `json:"roles"`
	Actor IdentitiesDelegationRequestsListOutputItemsDelegationPartiesActor `json:"actor"`
	// CreatedAt - Timestamp when the party was attached to the delegation.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationRequestsListOutputItemsDelegationRequestRequester represents the identities delegation requests list output items delegation request requester type.
type IdentitiesDelegationRequestsListOutputItemsDelegationRequestRequester struct {
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

// IdentitiesDelegationRequestsListOutputItemsDelegationRequest represents the identities delegation requests list output items delegation request type.
type IdentitiesDelegationRequestsListOutputItemsDelegationRequest struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation request identifier.
	Id string `json:"id"`
	// Status - Current status of the related delegation request.
	Status string `json:"status"`
	// DeniedReason - Reason the request was denied, if applicable.
	DeniedReason *string                                                               `json:"denied_reason,omitempty"`
	Requester    IdentitiesDelegationRequestsListOutputItemsDelegationRequestRequester `json:"requester"`
	// IdentityId - Identity targeted by the request.
	IdentityId string `json:"identity_id"`
	// ExpiresAt - Timestamp when the request expires.
	ExpiresAt time.Time `json:"expires_at"`
	// CreatedAt - Timestamp when the request was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationRequestsListOutputItemsDelegationCredentialOverrides represents the identities delegation requests list output items delegation credential overrides type.
type IdentitiesDelegationRequestsListOutputItemsDelegationCredentialOverrides struct {
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

// IdentitiesDelegationRequestsListOutputItemsDelegation represents the identities delegation requests list output items delegation type.
type IdentitiesDelegationRequestsListOutputItemsDelegation struct {
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
	Permissions []string                                                          `json:"permissions"`
	Attestation *IdentitiesDelegationRequestsListOutputItemsDelegationAttestation `json:"attestation,omitempty"`
	// Note - Optional note explaining the delegation.
	Note *string `json:"note,omitempty"`
	// Metadata - Additional metadata associated with the delegation.
	Metadata *map[string]any                                               `json:"metadata,omitempty"`
	Identity IdentitiesDelegationRequestsListOutputItemsDelegationIdentity `json:"identity"`
	// DelegationConfigId - Delegation config used to evaluate this delegation.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// Parties - Actors involved in the delegation and their roles.
	Parties []IdentitiesDelegationRequestsListOutputItemsDelegationParties `json:"parties"`
	Request *IdentitiesDelegationRequestsListOutputItemsDelegationRequest  `json:"request,omitempty"`
	// CredentialOverrides - Per-credential permission overrides attached to the delegation.
	CredentialOverrides []IdentitiesDelegationRequestsListOutputItemsDelegationCredentialOverrides `json:"credential_overrides"`
	// CreatedAt - Timestamp when the delegation was created.
	CreatedAt time.Time `json:"created_at"`
	// ExpiresAt - Timestamp when the delegation expires, if set.
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	// RevokedAt - Timestamp when the delegation was revoked, if revoked.
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
}

// IdentitiesDelegationRequestsListOutputItems represents the identities delegation requests list output items type.
type IdentitiesDelegationRequestsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation request identifier.
	Id string `json:"id"`
	// Status - Current status of the delegation request.
	Status string `json:"status"`
	// DeniedReason - Reason the request ultimately resulted in a denied delegation.
	DeniedReason *string                                              `json:"denied_reason,omitempty"`
	Requester    IdentitiesDelegationRequestsListOutputItemsRequester `json:"requester"`
	// IdentityId - Identity targeted by the delegation request.
	IdentityId string                                                `json:"identity_id"`
	Delegation IdentitiesDelegationRequestsListOutputItemsDelegation `json:"delegation"`
	// ExpiresAt - Timestamp when the delegation request expires.
	ExpiresAt time.Time `json:"expires_at"`
	// CreatedAt - Timestamp when the delegation request was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationRequestsListOutputPagination represents the identities delegation requests list output pagination type.
type IdentitiesDelegationRequestsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// IdentitiesDelegationRequestsListOutput represents the identities delegation requests list output type.
type IdentitiesDelegationRequestsListOutput struct {
	Items      []IdentitiesDelegationRequestsListOutputItems    `json:"items"`
	Pagination IdentitiesDelegationRequestsListOutputPagination `json:"pagination"`
}

// MapIdentitiesDelegationRequestsListOutputFromJSON deserializes JSON data into a IdentitiesDelegationRequestsListOutput.
func MapIdentitiesDelegationRequestsListOutputFromJSON(data []byte) (*IdentitiesDelegationRequestsListOutput, error) {
	var v IdentitiesDelegationRequestsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationRequestsListOutputToJSON serializes a IdentitiesDelegationRequestsListOutput to JSON.
func MapIdentitiesDelegationRequestsListOutputToJSON(v *IdentitiesDelegationRequestsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesDelegationRequestsListQuery represents the identities delegation requests list query type.
type IdentitiesDelegationRequestsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by one or more delegation request statuses.
	Status *any `json:"status,omitempty"`
	// Id - Filter by delegation request ID or IDs.
	Id *any `json:"id,omitempty"`
	// ActorId - Filter by requester actor ID or IDs.
	ActorId *any `json:"actor_id,omitempty"`
	// IdentityId - Filter by identity ID or IDs.
	IdentityId *any `json:"identity_id,omitempty"`
}

// MapIdentitiesDelegationRequestsListQueryFromJSON deserializes JSON data into a IdentitiesDelegationRequestsListQuery.
func MapIdentitiesDelegationRequestsListQueryFromJSON(data []byte) (*IdentitiesDelegationRequestsListQuery, error) {
	var v IdentitiesDelegationRequestsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationRequestsListQueryToJSON serializes a IdentitiesDelegationRequestsListQuery to JSON.
func MapIdentitiesDelegationRequestsListQueryToJSON(v *IdentitiesDelegationRequestsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
