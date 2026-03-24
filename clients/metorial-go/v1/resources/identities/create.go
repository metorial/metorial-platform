package identities

import (
	"encoding/json"
	"time"
)

// IdentitiesCreateOutputOwnerActor represents the identities create output owner actor type.
type IdentitiesCreateOutputOwnerActor struct {
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

// IdentitiesCreateOutputOwner represents the identities create output owner type.
type IdentitiesCreateOutputOwner struct {
	// Type - Owner type for the identity.
	Type  string                           `json:"type"`
	Actor IdentitiesCreateOutputOwnerActor `json:"actor"`
}

// IdentitiesCreateOutputCredentials represents the identities create output credentials type.
type IdentitiesCreateOutputCredentials struct {
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

// IdentitiesCreateOutput represents the identities create output type.
type IdentitiesCreateOutput struct {
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
	Metadata *map[string]any             `json:"metadata,omitempty"`
	Owner    IdentitiesCreateOutputOwner `json:"owner"`
	// Credentials - Credentials currently attached to the identity.
	Credentials []IdentitiesCreateOutputCredentials `json:"credentials"`
	// DelegationConfigId - Default delegation config applied to the identity.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// CreatedAt - Timestamp when the identity was created.
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the identity was last updated.
	UpdatedAt time.Time `json:"updated_at"`
}

// MapIdentitiesCreateOutputFromJSON deserializes JSON data into a IdentitiesCreateOutput.
func MapIdentitiesCreateOutputFromJSON(data []byte) (*IdentitiesCreateOutput, error) {
	var v IdentitiesCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesCreateOutputToJSON serializes a IdentitiesCreateOutput to JSON.
func MapIdentitiesCreateOutputToJSON(v *IdentitiesCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesCreateBodyCredentials represents the identities create body credentials type.
type IdentitiesCreateBodyCredentials struct {
	// DeploymentId - Provider deployment to attach to the identity.
	DeploymentId *string `json:"deployment_id,omitempty"`
	// ConfigId - Provider config to attach to the identity.
	ConfigId *string `json:"config_id,omitempty"`
	// AuthConfigId - Provider auth config to attach to the identity.
	AuthConfigId *string `json:"auth_config_id,omitempty"`
	// DelegationConfigId - Delegation config to apply to the new credential.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
}

// IdentitiesCreateBody represents the identities create body type.
type IdentitiesCreateBody struct {
	// ActorId - Identity actor that will own the new identity.
	ActorId string `json:"actor_id"`
	// Name - Optional display name for the identity.
	Name *string `json:"name,omitempty"`
	// Description - Optional description of the identity.
	Description *string `json:"description,omitempty"`
	// Metadata - Additional metadata to store on the identity.
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Credentials - Credentials to create and attach as part of identity creation.
	Credentials *[]IdentitiesCreateBodyCredentials `json:"credentials,omitempty"`
}

// MapIdentitiesCreateBodyFromJSON deserializes JSON data into a IdentitiesCreateBody.
func MapIdentitiesCreateBodyFromJSON(data []byte) (*IdentitiesCreateBody, error) {
	var v IdentitiesCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesCreateBodyToJSON serializes a IdentitiesCreateBody to JSON.
func MapIdentitiesCreateBodyToJSON(v *IdentitiesCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
