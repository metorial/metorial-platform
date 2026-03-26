package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/identities"
)

// IdentitiesEndpoint provides access to identities bundle credentials under a single owner actor so provider access can be managed and delegated consistently.
type IdentitiesEndpoint struct {
	client *endpoint.Client
}

// NewIdentitiesEndpoint creates a new IdentitiesEndpoint.
func NewIdentitiesEndpoint(client *endpoint.Client) *IdentitiesEndpoint {
	return &IdentitiesEndpoint{client: client}
}

// IdentitiesEndpointListParams contains optional query parameters for List.
type IdentitiesEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Search - Filter identities by name or description.
	Search *string `json:"search,omitempty"`
	// Status - Filter by one or more identity statuses.
	Status *any `json:"status,omitempty"`
	// Id - Filter by identity ID or IDs.
	Id *any `json:"id,omitempty"`
	// AgentId - Filter by owner agent ID or IDs.
	AgentId *any `json:"agent_id,omitempty"`
	// ActorId - Filter by owner identity actor ID or IDs.
	ActorId *any `json:"actor_id,omitempty"`
}

// IdentitiesEndpointCreateBody contains the request body for Create.
type IdentitiesEndpointCreateBody struct {
	// ActorId - Identity actor that will own the new identity.
	ActorId string `json:"actor_id"`
	// Name - Optional display name for the identity.
	Name *string `json:"name,omitempty"`
	// Description - Optional description of the identity.
	Description *string `json:"description,omitempty"`
	// Metadata - Additional metadata to store on the identity.
	Metadata *map[string]any `json:"metadata,omitempty"`
	// Credentials - Credentials to create and attach as part of identity creation.
	Credentials *[]map[string]any `json:"credentials,omitempty"`
}

// IdentitiesEndpointUpdateBody contains the request body for Update.
type IdentitiesEndpointUpdateBody struct {
	// Name - Updated display name for the identity.
	Name *string `json:"name,omitempty"`
	// Description - Updated description for the identity.
	Description *string `json:"description,omitempty"`
	// Metadata - Updated metadata for the identity.
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// List returns a paginated list of identities for the instance.
func (e *IdentitiesEndpoint) List(instanceId string, params *IdentitiesEndpointListParams) (*identities.IdentitiesListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "identities"},
		Query: query,
	}
	var result identities.IdentitiesListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific identity by ID.
func (e *IdentitiesEndpoint) Get(instanceId string, identityId string) (*identities.IdentitiesGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identities", identityId},
	}
	var result identities.IdentitiesGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new identity owned by an existing identity actor.
func (e *IdentitiesEndpoint) Create(instanceId string, body *IdentitiesEndpointCreateBody) (*identities.IdentitiesCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identities"},
		Body: body,
	}
	var result identities.IdentitiesCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates mutable fields on an existing identity.
func (e *IdentitiesEndpoint) Update(instanceId string, identityId string, body *IdentitiesEndpointUpdateBody) (*identities.IdentitiesUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identities", identityId},
		Body: body,
	}
	var result identities.IdentitiesUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete archives an identity.
func (e *IdentitiesEndpoint) Delete(instanceId string, identityId string) (*identities.IdentitiesDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identities", identityId},
	}
	var result identities.IdentitiesDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
