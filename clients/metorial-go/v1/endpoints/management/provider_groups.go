package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/providergroups"
)

// ProviderGroupsEndpoint provides access to a group is a user-defined custom folder for organizing providers in your instance like 'Sales Tools' or 'Engineering'.
type ProviderGroupsEndpoint struct {
	client *endpoint.Client
}

// NewProviderGroupsEndpoint creates a new ProviderGroupsEndpoint.
func NewProviderGroupsEndpoint(client *endpoint.Client) *ProviderGroupsEndpoint {
	return &ProviderGroupsEndpoint{client: client}
}

// ProviderGroupsEndpointListParams contains optional query parameters for List.
type ProviderGroupsEndpointListParams struct {
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

// ProviderGroupsEndpointCreateBody contains the request body for Create.
type ProviderGroupsEndpointCreateBody struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

// ProviderGroupsEndpointUpdateBody contains the request body for Update.
type ProviderGroupsEndpointUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

// ProviderGroupsEndpointAddListingBody contains the request body for AddListing.
type ProviderGroupsEndpointAddListingBody struct {
	ProviderListingId string `json:"provider_listing_id"`
}

// List returns a paginated list of provider groups.
func (e *ProviderGroupsEndpoint) List(instanceId string, params *ProviderGroupsEndpointListParams) (*providergroups.ProviderGroupsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "provider-groups"},
		Query: query,
	}
	var result providergroups.ProviderGroupsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific provider group by ID.
func (e *ProviderGroupsEndpoint) Get(instanceId string, providerGroupId string) (*providergroups.ProviderGroupsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-groups", providerGroupId},
	}
	var result providergroups.ProviderGroupsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new custom provider group.
func (e *ProviderGroupsEndpoint) Create(instanceId string, body *ProviderGroupsEndpointCreateBody) (*providergroups.ProviderGroupsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-groups"},
		Body: body,
	}
	var result providergroups.ProviderGroupsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates an existing provider group.
func (e *ProviderGroupsEndpoint) Update(instanceId string, providerGroupId string, body *ProviderGroupsEndpointUpdateBody) (*providergroups.ProviderGroupsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-groups", providerGroupId},
		Body: body,
	}
	var result providergroups.ProviderGroupsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// AddListing adds a provider listing to a group.
func (e *ProviderGroupsEndpoint) AddListing(instanceId string, providerGroupId string, body *ProviderGroupsEndpointAddListingBody) (*providergroups.ProviderGroupsAddListingOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-groups", providerGroupId, "listings"},
		Body: body,
	}
	var result providergroups.ProviderGroupsAddListingOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// RemoveListing removes a provider listing from a group.
func (e *ProviderGroupsEndpoint) RemoveListing(instanceId string, providerGroupId string, providerListingId string) (*providergroups.ProviderGroupsRemoveListingOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "provider-groups", providerGroupId, "listings", providerListingId},
	}
	var result providergroups.ProviderGroupsRemoveListingOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
