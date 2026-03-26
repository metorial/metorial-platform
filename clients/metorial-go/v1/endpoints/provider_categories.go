package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providercategories"
)

// ProviderCategoriesEndpoint provides access to a category groups providers by function like 'Developer Tools' or 'ERPs'.
type ProviderCategoriesEndpoint struct {
	client *endpoint.Client
}

// NewProviderCategoriesEndpoint creates a new ProviderCategoriesEndpoint.
func NewProviderCategoriesEndpoint(client *endpoint.Client) *ProviderCategoriesEndpoint {
	return &ProviderCategoriesEndpoint{client: client}
}

// ProviderCategoriesEndpointListParams contains optional query parameters for List.
type ProviderCategoriesEndpointListParams struct {
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

// List returns a paginated list of provider categories.
func (e *ProviderCategoriesEndpoint) List(params *ProviderCategoriesEndpointListParams) (*providercategories.ProviderCategoriesListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"provider-categories"},
		Query: query,
	}
	var result providercategories.ProviderCategoriesListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider category by ID.
func (e *ProviderCategoriesEndpoint) Get(providerCategoryId string) (*providercategories.ProviderCategoriesGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"provider-categories", providerCategoryId},
	}
	var result providercategories.ProviderCategoriesGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
