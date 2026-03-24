package identityactors

import (
	"encoding/json"
	"time"
)

// IdentityActorsCreateOutput represents the identity actors create output type.
type IdentityActorsCreateOutput struct {
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

// MapIdentityActorsCreateOutputFromJSON deserializes JSON data into a IdentityActorsCreateOutput.
func MapIdentityActorsCreateOutputFromJSON(data []byte) (*IdentityActorsCreateOutput, error) {
	var v IdentityActorsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentityActorsCreateOutputToJSON serializes a IdentityActorsCreateOutput to JSON.
func MapIdentityActorsCreateOutputToJSON(v *IdentityActorsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentityActorsCreateBody represents the identity actors create body type.
type IdentityActorsCreateBody struct {
	// Type - Whether this actor is a person or an agent.
	Type string `json:"type"`
	// Name - Human-readable display name for the actor.
	Name string `json:"name"`
	// Description - Optional description of the actor.
	Description *string `json:"description,omitempty"`
	// Metadata - Additional metadata to store on the actor.
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// MapIdentityActorsCreateBodyFromJSON deserializes JSON data into a IdentityActorsCreateBody.
func MapIdentityActorsCreateBodyFromJSON(data []byte) (*IdentityActorsCreateBody, error) {
	var v IdentityActorsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentityActorsCreateBodyToJSON serializes a IdentityActorsCreateBody to JSON.
func MapIdentityActorsCreateBodyToJSON(v *IdentityActorsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
