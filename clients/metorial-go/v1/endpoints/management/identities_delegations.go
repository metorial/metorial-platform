package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/identities/delegations"
)

// IdentitiesDelegationsEndpoint provides access to identity delegations grant provider permissions from one identity owner to another actor, with optional per-credential overrides.
type IdentitiesDelegationsEndpoint struct {
	client *endpoint.Client
}

// NewIdentitiesDelegationsEndpoint creates a new IdentitiesDelegationsEndpoint.
func NewIdentitiesDelegationsEndpoint(client *endpoint.Client) *IdentitiesDelegationsEndpoint {
	return &IdentitiesDelegationsEndpoint{client: client}
}

// IdentitiesDelegationsEndpointListParams contains optional query parameters for List.
type IdentitiesDelegationsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by one or more delegation statuses.
	Status *any `json:"status,omitempty"`
	// Permissions - Filter by one or more granted permissions.
	Permissions *any `json:"permissions,omitempty"`
	// Id - Filter by delegation ID or IDs.
	Id *any `json:"id,omitempty"`
	// OwnerActorId - Filter by owner actor ID or IDs.
	OwnerActorId *any `json:"owner_actor_id,omitempty"`
	// DelegatorActorId - Filter by delegator actor ID or IDs.
	DelegatorActorId *any `json:"delegator_actor_id,omitempty"`
	// DelegateeActorId - Filter by delegatee actor ID or IDs.
	DelegateeActorId *any `json:"delegatee_actor_id,omitempty"`
	// IdentityId - Filter by identity ID or IDs.
	IdentityId *any `json:"identity_id,omitempty"`
}

// IdentitiesDelegationsEndpointCreateBody contains the request body for Create.
type IdentitiesDelegationsEndpointCreateBody struct {
	// IdentityId - Identity to delegate.
	IdentityId string `json:"identity_id"`
	// DelegatorActorId - Actor initiating the delegation, if different from the owner.
	DelegatorActorId *string `json:"delegator_actor_id,omitempty"`
	// DelegateeActorId - Actor receiving the delegation.
	DelegateeActorId string `json:"delegatee_actor_id"`
	// Permissions - Permissions to grant as part of the delegation.
	Permissions *[]string `json:"permissions,omitempty"`
	// ExpiresAt - Optional expiration timestamp for the delegation.
	ExpiresAt *string `json:"expires_at,omitempty"`
	// DelegationConfigId - Delegation config to use for this delegation.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// CredentialOverrides - Optional per-credential permission overrides.
	CredentialOverrides *[]map[string]any `json:"credential_overrides,omitempty"`
	// Note - Optional human-readable note for the delegation.
	Note *string `json:"note,omitempty"`
	// Metadata - Additional metadata to store on the delegation.
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// List returns a paginated list of identity delegations for the instance.
func (e *IdentitiesDelegationsEndpoint) List(instanceId string, params *IdentitiesDelegationsEndpointListParams) (*delegations.IdentitiesDelegationsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "identity-delegations"},
		Query: query,
	}
	var result delegations.IdentitiesDelegationsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific identity delegation by ID.
func (e *IdentitiesDelegationsEndpoint) Get(instanceId string, identityDelegationId string) (*delegations.IdentitiesDelegationsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identity-delegations", identityDelegationId},
	}
	var result delegations.IdentitiesDelegationsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new identity delegation.
func (e *IdentitiesDelegationsEndpoint) Create(instanceId string, body *IdentitiesDelegationsEndpointCreateBody) (*delegations.IdentitiesDelegationsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identity-delegations"},
		Body: body,
	}
	var result delegations.IdentitiesDelegationsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Revoke revokes an existing identity delegation.
func (e *IdentitiesDelegationsEndpoint) Revoke(instanceId string, identityDelegationId string) (*delegations.IdentitiesDelegationsRevokeOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identity-delegations", identityDelegationId, "revoke"},
	}
	var result delegations.IdentitiesDelegationsRevokeOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
