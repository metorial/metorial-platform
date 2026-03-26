package delegationrequests

import (
	"encoding/json"
	"time"
)

// IdentitiesDelegationRequestsApproveOutputRequester represents the identities delegation requests approve output requester type.
type IdentitiesDelegationRequestsApproveOutputRequester struct {
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

// IdentitiesDelegationRequestsApproveOutputDelegationAttestation represents the identities delegation requests approve output delegation attestation type.
type IdentitiesDelegationRequestsApproveOutputDelegationAttestation struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique attestation identifier.
	Id string `json:"id"`
	// Type - Type of attestation, if any.
	Type string `json:"type"`
	// CreatedAt - Timestamp when the attestation was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationRequestsApproveOutputDelegationIdentity represents the identities delegation requests approve output delegation identity type.
type IdentitiesDelegationRequestsApproveOutputDelegationIdentity struct {
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

// IdentitiesDelegationRequestsApproveOutputDelegationPartiesActor represents the identities delegation requests approve output delegation parties actor type.
type IdentitiesDelegationRequestsApproveOutputDelegationPartiesActor struct {
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

// IdentitiesDelegationRequestsApproveOutputDelegationParties represents the identities delegation requests approve output delegation parties type.
type IdentitiesDelegationRequestsApproveOutputDelegationParties struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation party identifier.
	Id string `json:"id"`
	// Roles - Roles this actor has in the delegation.
	Roles []string                                                        `json:"roles"`
	Actor IdentitiesDelegationRequestsApproveOutputDelegationPartiesActor `json:"actor"`
	// CreatedAt - Timestamp when the party was attached to the delegation.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationRequestsApproveOutputDelegationRequestRequester represents the identities delegation requests approve output delegation request requester type.
type IdentitiesDelegationRequestsApproveOutputDelegationRequestRequester struct {
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

// IdentitiesDelegationRequestsApproveOutputDelegationRequest represents the identities delegation requests approve output delegation request type.
type IdentitiesDelegationRequestsApproveOutputDelegationRequest struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation request identifier.
	Id string `json:"id"`
	// Status - Current status of the related delegation request.
	Status string `json:"status"`
	// DeniedReason - Reason the request was denied, if applicable.
	DeniedReason *string                                                             `json:"denied_reason,omitempty"`
	Requester    IdentitiesDelegationRequestsApproveOutputDelegationRequestRequester `json:"requester"`
	// IdentityId - Identity targeted by the request.
	IdentityId string `json:"identity_id"`
	// ExpiresAt - Timestamp when the request expires.
	ExpiresAt time.Time `json:"expires_at"`
	// CreatedAt - Timestamp when the request was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationRequestsApproveOutputDelegationCredentialOverrides represents the identities delegation requests approve output delegation credential overrides type.
type IdentitiesDelegationRequestsApproveOutputDelegationCredentialOverrides struct {
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

// IdentitiesDelegationRequestsApproveOutputDelegation represents the identities delegation requests approve output delegation type.
type IdentitiesDelegationRequestsApproveOutputDelegation struct {
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
	Permissions []string                                                        `json:"permissions"`
	Attestation *IdentitiesDelegationRequestsApproveOutputDelegationAttestation `json:"attestation,omitempty"`
	// Note - Optional note explaining the delegation.
	Note *string `json:"note,omitempty"`
	// Metadata - Additional metadata associated with the delegation.
	Metadata *map[string]any                                             `json:"metadata,omitempty"`
	Identity IdentitiesDelegationRequestsApproveOutputDelegationIdentity `json:"identity"`
	// DelegationConfigId - Delegation config used to evaluate this delegation.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// Parties - Actors involved in the delegation and their roles.
	Parties []IdentitiesDelegationRequestsApproveOutputDelegationParties `json:"parties"`
	Request *IdentitiesDelegationRequestsApproveOutputDelegationRequest  `json:"request,omitempty"`
	// CredentialOverrides - Per-credential permission overrides attached to the delegation.
	CredentialOverrides []IdentitiesDelegationRequestsApproveOutputDelegationCredentialOverrides `json:"credential_overrides"`
	// CreatedAt - Timestamp when the delegation was created.
	CreatedAt time.Time `json:"created_at"`
	// ExpiresAt - Timestamp when the delegation expires, if set.
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	// RevokedAt - Timestamp when the delegation was revoked, if revoked.
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
}

// IdentitiesDelegationRequestsApproveOutput represents the identities delegation requests approve output type.
type IdentitiesDelegationRequestsApproveOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation request identifier.
	Id string `json:"id"`
	// Status - Current status of the delegation request.
	Status string `json:"status"`
	// DeniedReason - Reason the request ultimately resulted in a denied delegation.
	DeniedReason *string                                            `json:"denied_reason,omitempty"`
	Requester    IdentitiesDelegationRequestsApproveOutputRequester `json:"requester"`
	// IdentityId - Identity targeted by the delegation request.
	IdentityId string                                              `json:"identity_id"`
	Delegation IdentitiesDelegationRequestsApproveOutputDelegation `json:"delegation"`
	// ExpiresAt - Timestamp when the delegation request expires.
	ExpiresAt time.Time `json:"expires_at"`
	// CreatedAt - Timestamp when the delegation request was created.
	CreatedAt time.Time `json:"created_at"`
}

// MapIdentitiesDelegationRequestsApproveOutputFromJSON deserializes JSON data into a IdentitiesDelegationRequestsApproveOutput.
func MapIdentitiesDelegationRequestsApproveOutputFromJSON(data []byte) (*IdentitiesDelegationRequestsApproveOutput, error) {
	var v IdentitiesDelegationRequestsApproveOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationRequestsApproveOutputToJSON serializes a IdentitiesDelegationRequestsApproveOutput to JSON.
func MapIdentitiesDelegationRequestsApproveOutputToJSON(v *IdentitiesDelegationRequestsApproveOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesDelegationRequestsApproveQuery represents the identities delegation requests approve query type.
type IdentitiesDelegationRequestsApproveQuery struct {
	// AllowDeleted - Allow approving a request that is already deleted.
	AllowDeleted *bool `json:"allow_deleted,omitempty"`
}

// MapIdentitiesDelegationRequestsApproveQueryFromJSON deserializes JSON data into a IdentitiesDelegationRequestsApproveQuery.
func MapIdentitiesDelegationRequestsApproveQueryFromJSON(data []byte) (*IdentitiesDelegationRequestsApproveQuery, error) {
	var v IdentitiesDelegationRequestsApproveQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationRequestsApproveQueryToJSON serializes a IdentitiesDelegationRequestsApproveQuery to JSON.
func MapIdentitiesDelegationRequestsApproveQueryToJSON(v *IdentitiesDelegationRequestsApproveQuery) ([]byte, error) {
	return json.Marshal(v)
}
