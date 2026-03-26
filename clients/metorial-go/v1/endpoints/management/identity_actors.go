package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/identityactors"
)

// IdentityActorsEndpoint provides access to identity actors represent people or agents that can own identities and participate in delegations.
type IdentityActorsEndpoint struct {
	client *endpoint.Client
}

// NewIdentityActorsEndpoint creates a new IdentityActorsEndpoint.
func NewIdentityActorsEndpoint(client *endpoint.Client) *IdentityActorsEndpoint {
	return &IdentityActorsEndpoint{client: client}
}

// IdentityActorsEndpointListParams contains optional query parameters for List.
type IdentityActorsEndpointListParams struct {
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

// IdentityActorsEndpointCreateBody contains the request body for Create.
type IdentityActorsEndpointCreateBody struct {
	// Type - Whether this actor is a person or an agent.
	Type string `json:"type"`
	// Name - Human-readable display name for the actor.
	Name string `json:"name"`
	// Description - Optional description of the actor.
	Description *string `json:"description,omitempty"`
	// Metadata - Additional metadata to store on the actor.
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// IdentityActorsEndpointUpdateBody contains the request body for Update.
type IdentityActorsEndpointUpdateBody struct {
	// Name - Updated display name for the actor.
	Name *string `json:"name,omitempty"`
	// Description - Updated description for the actor.
	Description *string `json:"description,omitempty"`
	// Metadata - Updated metadata for the actor.
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// List returns a paginated list of identity actors for the instance.
func (e *IdentityActorsEndpoint) List(instanceId string, params *IdentityActorsEndpointListParams) (*identityactors.IdentityActorsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "identity-actors"},
		Query: query,
	}
	var result identityactors.IdentityActorsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific identity actor by ID.
func (e *IdentityActorsEndpoint) Get(instanceId string, identityActorId string) (*identityactors.IdentityActorsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identity-actors", identityActorId},
	}
	var result identityactors.IdentityActorsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new identity actor.
func (e *IdentityActorsEndpoint) Create(instanceId string, body *IdentityActorsEndpointCreateBody) (*identityactors.IdentityActorsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identity-actors"},
		Body: body,
	}
	var result identityactors.IdentityActorsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates mutable fields on an existing identity actor.
func (e *IdentityActorsEndpoint) Update(instanceId string, identityActorId string, body *IdentityActorsEndpointUpdateBody) (*identityactors.IdentityActorsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identity-actors", identityActorId},
		Body: body,
	}
	var result identityactors.IdentityActorsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete archives an identity actor.
func (e *IdentityActorsEndpoint) Delete(instanceId string, identityActorId string) (*identityactors.IdentityActorsDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identity-actors", identityActorId},
	}
	var result identityactors.IdentityActorsDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
