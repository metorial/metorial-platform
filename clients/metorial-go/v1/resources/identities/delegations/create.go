package delegations

import (
	"encoding/json"
	"time"
)

// IdentitiesDelegationsCreateOutputAttestation represents the identities delegations create output attestation type.
type IdentitiesDelegationsCreateOutputAttestation struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique attestation identifier.
	Id string `json:"id"`
	// Type - Type of attestation, if any.
	Type string `json:"type"`
	// CreatedAt - Timestamp when the attestation was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationsCreateOutputIdentity represents the identities delegations create output identity type.
type IdentitiesDelegationsCreateOutputIdentity struct {
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

// IdentitiesDelegationsCreateOutputPartiesActor represents the identities delegations create output parties actor type.
type IdentitiesDelegationsCreateOutputPartiesActor struct {
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

// IdentitiesDelegationsCreateOutputParties represents the identities delegations create output parties type.
type IdentitiesDelegationsCreateOutputParties struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation party identifier.
	Id string `json:"id"`
	// Roles - Roles this actor has in the delegation.
	Roles []string                                      `json:"roles"`
	Actor IdentitiesDelegationsCreateOutputPartiesActor `json:"actor"`
	// CreatedAt - Timestamp when the party was attached to the delegation.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationsCreateOutputRequestRequester represents the identities delegations create output request requester type.
type IdentitiesDelegationsCreateOutputRequestRequester struct {
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

// IdentitiesDelegationsCreateOutputRequest represents the identities delegations create output request type.
type IdentitiesDelegationsCreateOutputRequest struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation request identifier.
	Id string `json:"id"`
	// Status - Current status of the related delegation request.
	Status string `json:"status"`
	// DeniedReason - Reason the request was denied, if applicable.
	DeniedReason *string                                           `json:"denied_reason,omitempty"`
	Requester    IdentitiesDelegationsCreateOutputRequestRequester `json:"requester"`
	// IdentityId - Identity targeted by the request.
	IdentityId string `json:"identity_id"`
	// ExpiresAt - Timestamp when the request expires.
	ExpiresAt time.Time `json:"expires_at"`
	// CreatedAt - Timestamp when the request was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationsCreateOutputCredentialOverrides represents the identities delegations create output credential overrides type.
type IdentitiesDelegationsCreateOutputCredentialOverrides struct {
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

// IdentitiesDelegationsCreateOutput represents the identities delegations create output type.
type IdentitiesDelegationsCreateOutput struct {
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
	Permissions []string                                      `json:"permissions"`
	Attestation *IdentitiesDelegationsCreateOutputAttestation `json:"attestation,omitempty"`
	// Note - Optional note explaining the delegation.
	Note *string `json:"note,omitempty"`
	// Metadata - Additional metadata associated with the delegation.
	Metadata *map[string]any                           `json:"metadata,omitempty"`
	Identity IdentitiesDelegationsCreateOutputIdentity `json:"identity"`
	// DelegationConfigId - Delegation config used to evaluate this delegation.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// Parties - Actors involved in the delegation and their roles.
	Parties []IdentitiesDelegationsCreateOutputParties `json:"parties"`
	Request *IdentitiesDelegationsCreateOutputRequest  `json:"request,omitempty"`
	// CredentialOverrides - Per-credential permission overrides attached to the delegation.
	CredentialOverrides []IdentitiesDelegationsCreateOutputCredentialOverrides `json:"credential_overrides"`
	// CreatedAt - Timestamp when the delegation was created.
	CreatedAt time.Time `json:"created_at"`
	// ExpiresAt - Timestamp when the delegation expires, if set.
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	// RevokedAt - Timestamp when the delegation was revoked, if revoked.
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
}

// MapIdentitiesDelegationsCreateOutputFromJSON deserializes JSON data into a IdentitiesDelegationsCreateOutput.
func MapIdentitiesDelegationsCreateOutputFromJSON(data []byte) (*IdentitiesDelegationsCreateOutput, error) {
	var v IdentitiesDelegationsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationsCreateOutputToJSON serializes a IdentitiesDelegationsCreateOutput to JSON.
func MapIdentitiesDelegationsCreateOutputToJSON(v *IdentitiesDelegationsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesDelegationsCreateBodyCredentialOverrides represents the identities delegations create body credential overrides type.
type IdentitiesDelegationsCreateBodyCredentialOverrides struct {
	// CredentialId - Credential that should receive override permissions.
	CredentialId string `json:"credential_id"`
	// Permissions - Permissions to grant on the credential override.
	Permissions *[]string `json:"permissions,omitempty"`
	// ExpiresAt - Optional expiration timestamp for the credential override.
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

// IdentitiesDelegationsCreateBody represents the identities delegations create body type.
type IdentitiesDelegationsCreateBody struct {
	// IdentityId - Identity to delegate.
	IdentityId string `json:"identity_id"`
	// DelegatorActorId - Actor initiating the delegation, if different from the owner.
	DelegatorActorId *string `json:"delegator_actor_id,omitempty"`
	// DelegateeActorId - Actor receiving the delegation.
	DelegateeActorId string `json:"delegatee_actor_id"`
	// Permissions - Permissions to grant as part of the delegation.
	Permissions *[]string `json:"permissions,omitempty"`
	// ExpiresAt - Optional expiration timestamp for the delegation.
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	// DelegationConfigId - Delegation config to use for this delegation.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// CredentialOverrides - Optional per-credential permission overrides.
	CredentialOverrides *[]IdentitiesDelegationsCreateBodyCredentialOverrides `json:"credential_overrides,omitempty"`
	// Note - Optional human-readable note for the delegation.
	Note *string `json:"note,omitempty"`
	// Metadata - Additional metadata to store on the delegation.
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// MapIdentitiesDelegationsCreateBodyFromJSON deserializes JSON data into a IdentitiesDelegationsCreateBody.
func MapIdentitiesDelegationsCreateBodyFromJSON(data []byte) (*IdentitiesDelegationsCreateBody, error) {
	var v IdentitiesDelegationsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationsCreateBodyToJSON serializes a IdentitiesDelegationsCreateBody to JSON.
func MapIdentitiesDelegationsCreateBodyToJSON(v *IdentitiesDelegationsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
