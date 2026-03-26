package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providerlistings"
)

// ProviderListingsEndpoint provides access to a listing is a provider enriched with marketplace metadata.
type ProviderListingsEndpoint struct {
	client *endpoint.Client
}

// NewProviderListingsEndpoint creates a new ProviderListingsEndpoint.
func NewProviderListingsEndpoint(client *endpoint.Client) *ProviderListingsEndpoint {
	return &ProviderListingsEndpoint{client: client}
}

// ProviderListingsEndpointListParams contains optional query parameters for List.
type ProviderListingsEndpointListParams struct {
	Limit                *float64 `json:"limit,omitempty"`
	After                *string  `json:"after,omitempty"`
	Before               *string  `json:"before,omitempty"`
	Cursor               *string  `json:"cursor,omitempty"`
	Order                *string  `json:"order,omitempty"`
	Search               *string  `json:"search,omitempty"`
	ProviderCategoryId   *any     `json:"provider_category_id,omitempty"`
	ProviderCollectionId *any     `json:"provider_collection_id,omitempty"`
	ProviderGroupId      *any     `json:"provider_group_id,omitempty"`
	PublisherId          *any     `json:"publisher_id,omitempty"`
	IsOwner              *bool    `json:"is_owner,omitempty"`
	IsPublic             *bool    `json:"is_public,omitempty"`
	IsVerified           *bool    `json:"is_verified,omitempty"`
	IsOfficial           *bool    `json:"is_official,omitempty"`
	IsMetorial           *bool    `json:"is_metorial,omitempty"`
}

// List returns a paginated list of provider listings.
func (e *ProviderListingsEndpoint) List(params *ProviderListingsEndpointListParams) (*providerlistings.ProviderListingsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"provider-listings"},
		Query: query,
	}
	var result providerlistings.ProviderListingsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider listing by ID.
func (e *ProviderListingsEndpoint) Get(providerListingId string) (*providerlistings.ProviderListingsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"provider-listings", providerListingId},
	}
	var result providerlistings.ProviderListingsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
