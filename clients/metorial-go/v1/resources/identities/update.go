package identities

import (
	"encoding/json"
	"time"
)

// IdentitiesUpdateOutputOwnerActor represents the identities update output owner actor type.
type IdentitiesUpdateOutputOwnerActor struct {
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

// IdentitiesUpdateOutputOwner represents the identities update output owner type.
type IdentitiesUpdateOutputOwner struct {
	// Type - Owner type for the identity.
	Type  string                           `json:"type"`
	Actor IdentitiesUpdateOutputOwnerActor `json:"actor"`
}

// IdentitiesUpdateOutputCredentials represents the identities update output credentials type.
type IdentitiesUpdateOutputCredentials struct {
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

// IdentitiesUpdateOutput represents the identities update output type.
type IdentitiesUpdateOutput struct {
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
	Owner    IdentitiesUpdateOutputOwner `json:"owner"`
	// Credentials - Credentials currently attached to the identity.
	Credentials []IdentitiesUpdateOutputCredentials `json:"credentials"`
	// DelegationConfigId - Default delegation config applied to the identity.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// CreatedAt - Timestamp when the identity was created.
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the identity was last updated.
	UpdatedAt time.Time `json:"updated_at"`
}

// MapIdentitiesUpdateOutputFromJSON deserializes JSON data into a IdentitiesUpdateOutput.
func MapIdentitiesUpdateOutputFromJSON(data []byte) (*IdentitiesUpdateOutput, error) {
	var v IdentitiesUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesUpdateOutputToJSON serializes a IdentitiesUpdateOutput to JSON.
func MapIdentitiesUpdateOutputToJSON(v *IdentitiesUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesUpdateBody represents the identities update body type.
type IdentitiesUpdateBody struct {
	// Name - Updated display name for the identity.
	Name *string `json:"name,omitempty"`
	// Description - Updated description for the identity.
	Description *string `json:"description,omitempty"`
	// Metadata - Updated metadata for the identity.
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// MapIdentitiesUpdateBodyFromJSON deserializes JSON data into a IdentitiesUpdateBody.
func MapIdentitiesUpdateBodyFromJSON(data []byte) (*IdentitiesUpdateBody, error) {
	var v IdentitiesUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesUpdateBodyToJSON serializes a IdentitiesUpdateBody to JSON.
func MapIdentitiesUpdateBodyToJSON(v *IdentitiesUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
