package delegationrequests

import (
	"encoding/json"
	"time"
)

// IdentitiesDelegationRequestsCreateOutputRequester represents the identities delegation requests create output requester type.
type IdentitiesDelegationRequestsCreateOutputRequester struct {
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

// IdentitiesDelegationRequestsCreateOutputDelegationAttestation represents the identities delegation requests create output delegation attestation type.
type IdentitiesDelegationRequestsCreateOutputDelegationAttestation struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique attestation identifier.
	Id string `json:"id"`
	// Type - Type of attestation, if any.
	Type string `json:"type"`
	// CreatedAt - Timestamp when the attestation was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationRequestsCreateOutputDelegationIdentity represents the identities delegation requests create output delegation identity type.
type IdentitiesDelegationRequestsCreateOutputDelegationIdentity struct {
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

// IdentitiesDelegationRequestsCreateOutputDelegationPartiesActor represents the identities delegation requests create output delegation parties actor type.
type IdentitiesDelegationRequestsCreateOutputDelegationPartiesActor struct {
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

// IdentitiesDelegationRequestsCreateOutputDelegationParties represents the identities delegation requests create output delegation parties type.
type IdentitiesDelegationRequestsCreateOutputDelegationParties struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation party identifier.
	Id string `json:"id"`
	// Roles - Roles this actor has in the delegation.
	Roles []string                                                       `json:"roles"`
	Actor IdentitiesDelegationRequestsCreateOutputDelegationPartiesActor `json:"actor"`
	// CreatedAt - Timestamp when the party was attached to the delegation.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationRequestsCreateOutputDelegationRequestRequester represents the identities delegation requests create output delegation request requester type.
type IdentitiesDelegationRequestsCreateOutputDelegationRequestRequester struct {
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

// IdentitiesDelegationRequestsCreateOutputDelegationRequest represents the identities delegation requests create output delegation request type.
type IdentitiesDelegationRequestsCreateOutputDelegationRequest struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation request identifier.
	Id string `json:"id"`
	// Status - Current status of the related delegation request.
	Status string `json:"status"`
	// DeniedReason - Reason the request was denied, if applicable.
	DeniedReason *string                                                            `json:"denied_reason,omitempty"`
	Requester    IdentitiesDelegationRequestsCreateOutputDelegationRequestRequester `json:"requester"`
	// IdentityId - Identity targeted by the request.
	IdentityId string `json:"identity_id"`
	// ExpiresAt - Timestamp when the request expires.
	ExpiresAt time.Time `json:"expires_at"`
	// CreatedAt - Timestamp when the request was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationRequestsCreateOutputDelegationCredentialOverrides represents the identities delegation requests create output delegation credential overrides type.
type IdentitiesDelegationRequestsCreateOutputDelegationCredentialOverrides struct {
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

// IdentitiesDelegationRequestsCreateOutputDelegation represents the identities delegation requests create output delegation type.
type IdentitiesDelegationRequestsCreateOutputDelegation struct {
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
	Permissions []string                                                       `json:"permissions"`
	Attestation *IdentitiesDelegationRequestsCreateOutputDelegationAttestation `json:"attestation,omitempty"`
	// Note - Optional note explaining the delegation.
	Note *string `json:"note,omitempty"`
	// Metadata - Additional metadata associated with the delegation.
	Metadata *map[string]any                                            `json:"metadata,omitempty"`
	Identity IdentitiesDelegationRequestsCreateOutputDelegationIdentity `json:"identity"`
	// DelegationConfigId - Delegation config used to evaluate this delegation.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// Parties - Actors involved in the delegation and their roles.
	Parties []IdentitiesDelegationRequestsCreateOutputDelegationParties `json:"parties"`
	Request *IdentitiesDelegationRequestsCreateOutputDelegationRequest  `json:"request,omitempty"`
	// CredentialOverrides - Per-credential permission overrides attached to the delegation.
	CredentialOverrides []IdentitiesDelegationRequestsCreateOutputDelegationCredentialOverrides `json:"credential_overrides"`
	// CreatedAt - Timestamp when the delegation was created.
	CreatedAt time.Time `json:"created_at"`
	// ExpiresAt - Timestamp when the delegation expires, if set.
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	// RevokedAt - Timestamp when the delegation was revoked, if revoked.
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
}

// IdentitiesDelegationRequestsCreateOutput represents the identities delegation requests create output type.
type IdentitiesDelegationRequestsCreateOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation request identifier.
	Id string `json:"id"`
	// Status - Current status of the delegation request.
	Status string `json:"status"`
	// DeniedReason - Reason the request ultimately resulted in a denied delegation.
	DeniedReason *string                                           `json:"denied_reason,omitempty"`
	Requester    IdentitiesDelegationRequestsCreateOutputRequester `json:"requester"`
	// IdentityId - Identity targeted by the delegation request.
	IdentityId string                                             `json:"identity_id"`
	Delegation IdentitiesDelegationRequestsCreateOutputDelegation `json:"delegation"`
	// ExpiresAt - Timestamp when the delegation request expires.
	ExpiresAt time.Time `json:"expires_at"`
	// CreatedAt - Timestamp when the delegation request was created.
	CreatedAt time.Time `json:"created_at"`
}

// MapIdentitiesDelegationRequestsCreateOutputFromJSON deserializes JSON data into a IdentitiesDelegationRequestsCreateOutput.
func MapIdentitiesDelegationRequestsCreateOutputFromJSON(data []byte) (*IdentitiesDelegationRequestsCreateOutput, error) {
	var v IdentitiesDelegationRequestsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationRequestsCreateOutputToJSON serializes a IdentitiesDelegationRequestsCreateOutput to JSON.
func MapIdentitiesDelegationRequestsCreateOutputToJSON(v *IdentitiesDelegationRequestsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesDelegationRequestsCreateBodyCredentialOverrides represents the identities delegation requests create body credential overrides type.
type IdentitiesDelegationRequestsCreateBodyCredentialOverrides struct {
	// CredentialId - Credential that should receive override permissions.
	CredentialId string `json:"credential_id"`
	// Permissions - Permissions to grant on the credential override.
	Permissions *[]string `json:"permissions,omitempty"`
	// ExpiresAt - Optional expiration timestamp for the credential override.
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// IdentitiesDelegationRequestsCreateBody represents the identities delegation requests create body type.
type IdentitiesDelegationRequestsCreateBody struct {
	// IdentityId - Identity to request delegation for.
	IdentityId string `json:"identity_id"`
	// RequesterActorId - Actor requesting the delegation.
	RequesterActorId string `json:"requester_actor_id"`
	// DelegatorActorId - Actor submitting the request on behalf of the requester.
	DelegatorActorId *string `json:"delegator_actor_id,omitempty"`
	// Permissions - Permissions being requested.
	Permissions *[]string `json:"permissions,omitempty"`
	// ExpiresAt - Timestamp when the request should expire.
	ExpiresAt time.Time `json:"expires_at"`
	// DelegationConfigId - Delegation config to use for the resulting delegation.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// CredentialOverrides - Optional per-credential permission overrides.
	CredentialOverrides *[]IdentitiesDelegationRequestsCreateBodyCredentialOverrides `json:"credential_overrides,omitempty"`
	// Note - Optional human-readable note for the request.
	Note *string `json:"note,omitempty"`
	// Metadata - Additional metadata to store on the request.
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// MapIdentitiesDelegationRequestsCreateBodyFromJSON deserializes JSON data into a IdentitiesDelegationRequestsCreateBody.
func MapIdentitiesDelegationRequestsCreateBodyFromJSON(data []byte) (*IdentitiesDelegationRequestsCreateBody, error) {
	var v IdentitiesDelegationRequestsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationRequestsCreateBodyToJSON serializes a IdentitiesDelegationRequestsCreateBody to JSON.
func MapIdentitiesDelegationRequestsCreateBodyToJSON(v *IdentitiesDelegationRequestsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
