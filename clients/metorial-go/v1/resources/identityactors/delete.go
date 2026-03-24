package identityactors

import (
	"encoding/json"
	"time"
)

// IdentityActorsDeleteOutput represents the identity actors delete output type.
type IdentityActorsDeleteOutput struct {
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

// MapIdentityActorsDeleteOutputFromJSON deserializes JSON data into a IdentityActorsDeleteOutput.
func MapIdentityActorsDeleteOutputFromJSON(data []byte) (*IdentityActorsDeleteOutput, error) {
	var v IdentityActorsDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentityActorsDeleteOutputToJSON serializes a IdentityActorsDeleteOutput to JSON.
func MapIdentityActorsDeleteOutputToJSON(v *IdentityActorsDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
