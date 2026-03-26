package identities

import (
	"encoding/json"
	"time"
)

// IdentitiesGetOutputOwnerActor represents the identities get output owner actor type.
type IdentitiesGetOutputOwnerActor struct {
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

// IdentitiesGetOutputOwner represents the identities get output owner type.
type IdentitiesGetOutputOwner struct {
	// Type - Owner type for the identity.
	Type  string                        `json:"type"`
	Actor IdentitiesGetOutputOwnerActor `json:"actor"`
}

// IdentitiesGetOutputCredentials represents the identities get output credentials type.
type IdentitiesGetOutputCredentials struct {
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

// IdentitiesGetOutput represents the identities get output type.
type IdentitiesGetOutput struct {
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
	Metadata *map[string]any          `json:"metadata,omitempty"`
	Owner    IdentitiesGetOutputOwner `json:"owner"`
	// Credentials - Credentials currently attached to the identity.
	Credentials []IdentitiesGetOutputCredentials `json:"credentials"`
	// DelegationConfigId - Default delegation config applied to the identity.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// CreatedAt - Timestamp when the identity was created.
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the identity was last updated.
	UpdatedAt time.Time `json:"updated_at"`
}

// MapIdentitiesGetOutputFromJSON deserializes JSON data into a IdentitiesGetOutput.
func MapIdentitiesGetOutputFromJSON(data []byte) (*IdentitiesGetOutput, error) {
	var v IdentitiesGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesGetOutputToJSON serializes a IdentitiesGetOutput to JSON.
func MapIdentitiesGetOutputToJSON(v *IdentitiesGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
