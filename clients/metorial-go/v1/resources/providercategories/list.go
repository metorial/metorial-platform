package providercategories

import (
	"encoding/json"
	"time"
)

// ProviderCategoriesListOutputItems represents the provider categories list output items type.
type ProviderCategoriesListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique category identifier
	Id string `json:"id"`
	// Name - Display name of the category
	Name string `json:"name"`
	// Description - Description of providers in this category
	Description string `json:"description"`
	// Slug - URL-friendly identifier
	Slug string `json:"slug"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// ProviderCategoriesListOutputPagination represents the provider categories list output pagination type.
type ProviderCategoriesListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// ProviderCategoriesListOutput represents the provider categories list output type.
type ProviderCategoriesListOutput struct {
	Items      []ProviderCategoriesListOutputItems    `json:"items"`
	Pagination ProviderCategoriesListOutputPagination `json:"pagination"`
}

// MapProviderCategoriesListOutputFromJSON deserializes JSON data into a ProviderCategoriesListOutput.
func MapProviderCategoriesListOutputFromJSON(data []byte) (*ProviderCategoriesListOutput, error) {
	var v ProviderCategoriesListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderCategoriesListOutputToJSON serializes a ProviderCategoriesListOutput to JSON.
func MapProviderCategoriesListOutputToJSON(v *ProviderCategoriesListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderCategoriesListQuery represents the provider categories list query type.
type ProviderCategoriesListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Id - Filter by category ID(s)
	Id *any `json:"id,omitempty"`
	// ProviderId - Filter by provider ID(s)
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderListingId - Filter by provider listing ID(s)
	ProviderListingId *any `json:"provider_listing_id,omitempty"`
}

// MapProviderCategoriesListQueryFromJSON deserializes JSON data into a ProviderCategoriesListQuery.
func MapProviderCategoriesListQueryFromJSON(data []byte) (*ProviderCategoriesListQuery, error) {
	var v ProviderCategoriesListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderCategoriesListQueryToJSON serializes a ProviderCategoriesListQuery to JSON.
func MapProviderCategoriesListQueryToJSON(v *ProviderCategoriesListQuery) ([]byte, error) {
	return json.Marshal(v)
}
