package providergroups

import (
	"encoding/json"
	"time"
)

// ProviderGroupsListOutputItems represents the provider groups list output items type.
type ProviderGroupsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique group identifier
	Id string `json:"id"`
	// Name - Display name of the group
	Name string `json:"name"`
	// Description - Description of the group
	Description *string `json:"description,omitempty"`
	// Slug - URL-friendly identifier
	Slug string `json:"slug"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderGroupsListOutputPagination represents the provider groups list output pagination type.
type ProviderGroupsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderGroupsListOutput represents the provider groups list output type.
type ProviderGroupsListOutput struct {
	Items      []ProviderGroupsListOutputItems    `json:"items"`
	Pagination ProviderGroupsListOutputPagination `json:"pagination"`
}

// MapProviderGroupsListOutputFromJSON deserializes JSON data into a ProviderGroupsListOutput.
func MapProviderGroupsListOutputFromJSON(data []byte) (*ProviderGroupsListOutput, error) {
	var v ProviderGroupsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderGroupsListOutputToJSON serializes a ProviderGroupsListOutput to JSON.
func MapProviderGroupsListOutputToJSON(v *ProviderGroupsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderGroupsListQuery represents the provider groups list query type.
type ProviderGroupsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by group ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderListingId - Filter by provider listing ID(s)
	ProviderListingId *any `json:"provider_listing_id,omitempty"`
}

// MapProviderGroupsListQueryFromJSON deserializes JSON data into a ProviderGroupsListQuery.
func MapProviderGroupsListQueryFromJSON(data []byte) (*ProviderGroupsListQuery, error) {
	var v ProviderGroupsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderGroupsListQueryToJSON serializes a ProviderGroupsListQuery to JSON.
func MapProviderGroupsListQueryToJSON(v *ProviderGroupsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
