package delegations

import (
	"encoding/json"
	"time"
)

// IdentitiesDelegationsGetOutputAttestation represents the identities delegations get output attestation type.
type IdentitiesDelegationsGetOutputAttestation struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique attestation identifier.
	Id string `json:"id"`
	// Type - Type of attestation, if any.
	Type string `json:"type"`
	// CreatedAt - Timestamp when the attestation was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationsGetOutputIdentity represents the identities delegations get output identity type.
type IdentitiesDelegationsGetOutputIdentity struct {
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

// IdentitiesDelegationsGetOutputPartiesActor represents the identities delegations get output parties actor type.
type IdentitiesDelegationsGetOutputPartiesActor struct {
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

// IdentitiesDelegationsGetOutputParties represents the identities delegations get output parties type.
type IdentitiesDelegationsGetOutputParties struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation party identifier.
	Id string `json:"id"`
	// Roles - Roles this actor has in the delegation.
	Roles []string                                   `json:"roles"`
	Actor IdentitiesDelegationsGetOutputPartiesActor `json:"actor"`
	// CreatedAt - Timestamp when the party was attached to the delegation.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationsGetOutputRequestRequester represents the identities delegations get output request requester type.
type IdentitiesDelegationsGetOutputRequestRequester struct {
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

// IdentitiesDelegationsGetOutputRequest represents the identities delegations get output request type.
type IdentitiesDelegationsGetOutputRequest struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation request identifier.
	Id string `json:"id"`
	// Status - Current status of the related delegation request.
	Status string `json:"status"`
	// DeniedReason - Reason the request was denied, if applicable.
	DeniedReason *string                                        `json:"denied_reason,omitempty"`
	Requester    IdentitiesDelegationsGetOutputRequestRequester `json:"requester"`
	// IdentityId - Identity targeted by the request.
	IdentityId string `json:"identity_id"`
	// ExpiresAt - Timestamp when the request expires.
	ExpiresAt time.Time `json:"expires_at"`
	// CreatedAt - Timestamp when the request was created.
	CreatedAt time.Time `json:"created_at"`
}

// IdentitiesDelegationsGetOutputCredentialOverrides represents the identities delegations get output credential overrides type.
type IdentitiesDelegationsGetOutputCredentialOverrides struct {
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

// IdentitiesDelegationsGetOutput represents the identities delegations get output type.
type IdentitiesDelegationsGetOutput struct {
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
	Permissions []string                                   `json:"permissions"`
	Attestation *IdentitiesDelegationsGetOutputAttestation `json:"attestation,omitempty"`
	// Note - Optional note explaining the delegation.
	Note *string `json:"note,omitempty"`
	// Metadata - Additional metadata associated with the delegation.
	Metadata *map[string]any                        `json:"metadata,omitempty"`
	Identity IdentitiesDelegationsGetOutputIdentity `json:"identity"`
	// DelegationConfigId - Delegation config used to evaluate this delegation.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// Parties - Actors involved in the delegation and their roles.
	Parties []IdentitiesDelegationsGetOutputParties `json:"parties"`
	Request *IdentitiesDelegationsGetOutputRequest  `json:"request,omitempty"`
	// CredentialOverrides - Per-credential permission overrides attached to the delegation.
	CredentialOverrides []IdentitiesDelegationsGetOutputCredentialOverrides `json:"credential_overrides"`
	// CreatedAt - Timestamp when the delegation was created.
	CreatedAt time.Time `json:"created_at"`
	// ExpiresAt - Timestamp when the delegation expires, if set.
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	// RevokedAt - Timestamp when the delegation was revoked, if revoked.
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
}

// MapIdentitiesDelegationsGetOutputFromJSON deserializes JSON data into a IdentitiesDelegationsGetOutput.
func MapIdentitiesDelegationsGetOutputFromJSON(data []byte) (*IdentitiesDelegationsGetOutput, error) {
	var v IdentitiesDelegationsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationsGetOutputToJSON serializes a IdentitiesDelegationsGetOutput to JSON.
func MapIdentitiesDelegationsGetOutputToJSON(v *IdentitiesDelegationsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
