package identityactors

import (
	"encoding/json"
	"time"
)

// IdentityActorsUpdateOutput represents the identity actors update output type.
type IdentityActorsUpdateOutput struct {
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

// MapIdentityActorsUpdateOutputFromJSON deserializes JSON data into a IdentityActorsUpdateOutput.
func MapIdentityActorsUpdateOutputFromJSON(data []byte) (*IdentityActorsUpdateOutput, error) {
	var v IdentityActorsUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentityActorsUpdateOutputToJSON serializes a IdentityActorsUpdateOutput to JSON.
func MapIdentityActorsUpdateOutputToJSON(v *IdentityActorsUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentityActorsUpdateBody represents the identity actors update body type.
type IdentityActorsUpdateBody struct {
	// Name - Updated display name for the actor.
	Name *string `json:"name,omitempty"`
	// Description - Updated description for the actor.
	Description *string `json:"description,omitempty"`
	// Metadata - Updated metadata for the actor.
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// MapIdentityActorsUpdateBodyFromJSON deserializes JSON data into a IdentityActorsUpdateBody.
func MapIdentityActorsUpdateBodyFromJSON(data []byte) (*IdentityActorsUpdateBody, error) {
	var v IdentityActorsUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentityActorsUpdateBodyToJSON serializes a IdentityActorsUpdateBody to JSON.
func MapIdentityActorsUpdateBodyToJSON(v *IdentityActorsUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
