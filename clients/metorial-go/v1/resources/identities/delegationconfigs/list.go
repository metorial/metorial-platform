package delegationconfigs

import (
	"encoding/json"
	"time"
)

// IdentitiesDelegationConfigsListOutputItems represents the identities delegation configs list output items type.
type IdentitiesDelegationConfigsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation config identifier.
	Id string `json:"id"`
	// Status - Current lifecycle status of the delegation config.
	Status string `json:"status"`
	// IsDefault - Whether this config is the default config for the environment.
	IsDefault bool `json:"is_default"`
	// Name - Human-readable name of the delegation config.
	Name *string `json:"name,omitempty"`
	// Description - Optional description of the delegation policy.
	Description *string `json:"description,omitempty"`
	// Metadata - Additional metadata associated with the delegation config.
	Metadata *map[string]any `json:"metadata,omitempty"`
	// SubDelegationBehavior - How this config handles sub-delegation requests.
	SubDelegationBehavior string `json:"sub_delegation_behavior"`
	// SubDelegationDepth - Maximum allowed sub-delegation depth for this policy.
	SubDelegationDepth float64 `json:"sub_delegation_depth"`
	// CreatedAt - Timestamp when the delegation config was created.
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the delegation config was last updated.
	UpdatedAt time.Time `json:"updated_at"`
}

// IdentitiesDelegationConfigsListOutputPagination represents the identities delegation configs list output pagination type.
type IdentitiesDelegationConfigsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// IdentitiesDelegationConfigsListOutput represents the identities delegation configs list output type.
type IdentitiesDelegationConfigsListOutput struct {
	Items      []IdentitiesDelegationConfigsListOutputItems    `json:"items"`
	Pagination IdentitiesDelegationConfigsListOutputPagination `json:"pagination"`
}

// MapIdentitiesDelegationConfigsListOutputFromJSON deserializes JSON data into a IdentitiesDelegationConfigsListOutput.
func MapIdentitiesDelegationConfigsListOutputFromJSON(data []byte) (*IdentitiesDelegationConfigsListOutput, error) {
	var v IdentitiesDelegationConfigsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationConfigsListOutputToJSON serializes a IdentitiesDelegationConfigsListOutput to JSON.
func MapIdentitiesDelegationConfigsListOutputToJSON(v *IdentitiesDelegationConfigsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesDelegationConfigsListQuery represents the identities delegation configs list query type.
type IdentitiesDelegationConfigsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Search - Filter configs by name or description.
	Search *string `json:"search,omitempty"`
	// Status - Filter by one or more config statuses.
	Status *any `json:"status,omitempty"`
	// Id - Filter by config ID or IDs.
	Id *any `json:"id,omitempty"`
}

// MapIdentitiesDelegationConfigsListQueryFromJSON deserializes JSON data into a IdentitiesDelegationConfigsListQuery.
func MapIdentitiesDelegationConfigsListQueryFromJSON(data []byte) (*IdentitiesDelegationConfigsListQuery, error) {
	var v IdentitiesDelegationConfigsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationConfigsListQueryToJSON serializes a IdentitiesDelegationConfigsListQuery to JSON.
func MapIdentitiesDelegationConfigsListQueryToJSON(v *IdentitiesDelegationConfigsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
