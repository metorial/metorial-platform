package providercollections

import (
	"encoding/json"
	"time"
)

// ProviderCollectionsListOutputItems represents the provider collections list output items type.
type ProviderCollectionsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique collection identifier
	Id string `json:"id"`
	// Name - Display name of the collection
	Name string `json:"name"`
	// Description - Description of the collection
	Description string `json:"description"`
	// Slug - URL-friendly identifier
	Slug string `json:"slug"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderCollectionsListOutputPagination represents the provider collections list output pagination type.
type ProviderCollectionsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderCollectionsListOutput represents the provider collections list output type.
type ProviderCollectionsListOutput struct {
	Items      []ProviderCollectionsListOutputItems    `json:"items"`
	Pagination ProviderCollectionsListOutputPagination `json:"pagination"`
}

// MapProviderCollectionsListOutputFromJSON deserializes JSON data into a ProviderCollectionsListOutput.
func MapProviderCollectionsListOutputFromJSON(data []byte) (*ProviderCollectionsListOutput, error) {
	var v ProviderCollectionsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderCollectionsListOutputToJSON serializes a ProviderCollectionsListOutput to JSON.
func MapProviderCollectionsListOutputToJSON(v *ProviderCollectionsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderCollectionsListQuery represents the provider collections list query type.
type ProviderCollectionsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by collection ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderListingId - Filter by provider listing ID(s)
	ProviderListingId *any `json:"provider_listing_id,omitempty"`
}

// MapProviderCollectionsListQueryFromJSON deserializes JSON data into a ProviderCollectionsListQuery.
func MapProviderCollectionsListQueryFromJSON(data []byte) (*ProviderCollectionsListQuery, error) {
	var v ProviderCollectionsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderCollectionsListQueryToJSON serializes a ProviderCollectionsListQuery to JSON.
func MapProviderCollectionsListQueryToJSON(v *ProviderCollectionsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
