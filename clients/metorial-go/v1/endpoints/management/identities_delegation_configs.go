package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/identities/delegationconfigs"
)

// IdentitiesDelegationConfigsEndpoint provides access to delegation configs define the default policy for sub-delegation behavior and delegation depth.
type IdentitiesDelegationConfigsEndpoint struct {
	client *endpoint.Client
}

// NewIdentitiesDelegationConfigsEndpoint creates a new IdentitiesDelegationConfigsEndpoint.
func NewIdentitiesDelegationConfigsEndpoint(client *endpoint.Client) *IdentitiesDelegationConfigsEndpoint {
	return &IdentitiesDelegationConfigsEndpoint{client: client}
}

// IdentitiesDelegationConfigsEndpointListParams contains optional query parameters for List.
type IdentitiesDelegationConfigsEndpointListParams struct {
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

// IdentitiesDelegationConfigsEndpointCreateBody contains the request body for Create.
type IdentitiesDelegationConfigsEndpointCreateBody struct {
	// Name - Optional display name for the delegation config.
	Name *string `json:"name,omitempty"`
	// Description - Optional description of the delegation policy.
	Description *string `json:"description,omitempty"`
	// Metadata - Additional metadata to store on the delegation config.
	Metadata *map[string]any `json:"metadata,omitempty"`
	// SubDelegationBehavior - How sub-delegations should be handled.
	SubDelegationBehavior string `json:"sub_delegation_behavior"`
	// SubDelegationDepth - Maximum allowed sub-delegation depth.
	SubDelegationDepth *float64 `json:"sub_delegation_depth,omitempty"`
}

// IdentitiesDelegationConfigsEndpointUpdateBody contains the request body for Update.
type IdentitiesDelegationConfigsEndpointUpdateBody struct {
	// Name - Updated display name for the delegation config.
	Name *string `json:"name,omitempty"`
	// Description - Updated description for the delegation config.
	Description *string `json:"description,omitempty"`
	// Metadata - Updated metadata for the delegation config.
	Metadata *map[string]any `json:"metadata,omitempty"`
	// SubDelegationBehavior - How sub-delegations should be handled.
	SubDelegationBehavior *string `json:"sub_delegation_behavior,omitempty"`
	// SubDelegationDepth - Maximum allowed sub-delegation depth.
	SubDelegationDepth *float64 `json:"sub_delegation_depth,omitempty"`
}

// List returns a paginated list of identity delegation configs.
func (e *IdentitiesDelegationConfigsEndpoint) List(instanceId string, params *IdentitiesDelegationConfigsEndpointListParams) (*delegationconfigs.IdentitiesDelegationConfigsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "identity-delegation-configs"},
		Query: query,
	}
	var result delegationconfigs.IdentitiesDelegationConfigsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific identity delegation config by ID.
func (e *IdentitiesDelegationConfigsEndpoint) Get(instanceId string, identityDelegationConfigId string) (*delegationconfigs.IdentitiesDelegationConfigsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identity-delegation-configs", identityDelegationConfigId},
	}
	var result delegationconfigs.IdentitiesDelegationConfigsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new identity delegation config.
func (e *IdentitiesDelegationConfigsEndpoint) Create(instanceId string, body *IdentitiesDelegationConfigsEndpointCreateBody) (*delegationconfigs.IdentitiesDelegationConfigsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identity-delegation-configs"},
		Body: body,
	}
	var result delegationconfigs.IdentitiesDelegationConfigsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates mutable fields on an existing identity delegation config.
func (e *IdentitiesDelegationConfigsEndpoint) Update(instanceId string, identityDelegationConfigId string, body *IdentitiesDelegationConfigsEndpointUpdateBody) (*delegationconfigs.IdentitiesDelegationConfigsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identity-delegation-configs", identityDelegationConfigId},
		Body: body,
	}
	var result delegationconfigs.IdentitiesDelegationConfigsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete archives an identity delegation config.
func (e *IdentitiesDelegationConfigsEndpoint) Delete(instanceId string, identityDelegationConfigId string) (*delegationconfigs.IdentitiesDelegationConfigsDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identity-delegation-configs", identityDelegationConfigId},
	}
	var result delegationconfigs.IdentitiesDelegationConfigsDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
