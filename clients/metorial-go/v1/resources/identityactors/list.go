package identityactors

import (
	"encoding/json"
	"time"
)

// IdentityActorsListOutputItems represents the identity actors list output items type.
type IdentityActorsListOutputItems struct {
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

// IdentityActorsListOutputPagination represents the identity actors list output pagination type.
type IdentityActorsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// IdentityActorsListOutput represents the identity actors list output type.
type IdentityActorsListOutput struct {
	Items      []IdentityActorsListOutputItems    `json:"items"`
	Pagination IdentityActorsListOutputPagination `json:"pagination"`
}

// MapIdentityActorsListOutputFromJSON deserializes JSON data into a IdentityActorsListOutput.
func MapIdentityActorsListOutputFromJSON(data []byte) (*IdentityActorsListOutput, error) {
	var v IdentityActorsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentityActorsListOutputToJSON serializes a IdentityActorsListOutput to JSON.
func MapIdentityActorsListOutputToJSON(v *IdentityActorsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentityActorsListQuery represents the identity actors list query type.
type IdentityActorsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Search - Filter actors by name or description.
	Search *string `json:"search,omitempty"`
	// Status - Filter by one or more actor statuses.
	Status *any `json:"status,omitempty"`
	// Id - Filter by identity actor ID or IDs.
	Id *any `json:"id,omitempty"`
	// AgentId - Filter by linked agent ID or IDs.
	AgentId *any `json:"agent_id,omitempty"`
}

// MapIdentityActorsListQueryFromJSON deserializes JSON data into a IdentityActorsListQuery.
func MapIdentityActorsListQueryFromJSON(data []byte) (*IdentityActorsListQuery, error) {
	var v IdentityActorsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentityActorsListQueryToJSON serializes a IdentityActorsListQuery to JSON.
func MapIdentityActorsListQueryToJSON(v *IdentityActorsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
