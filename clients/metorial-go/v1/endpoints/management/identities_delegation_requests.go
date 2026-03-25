package management

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/identities/delegationrequests"
)

// IdentitiesDelegationRequestsEndpoint provides access to identity delegation requests represent approval workflows for creating delegations that require consent.
type IdentitiesDelegationRequestsEndpoint struct {
	client *endpoint.Client
}

// NewIdentitiesDelegationRequestsEndpoint creates a new IdentitiesDelegationRequestsEndpoint.
func NewIdentitiesDelegationRequestsEndpoint(client *endpoint.Client) *IdentitiesDelegationRequestsEndpoint {
	return &IdentitiesDelegationRequestsEndpoint{client: client}
}

// IdentitiesDelegationRequestsEndpointListParams contains optional query parameters for List.
type IdentitiesDelegationRequestsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by one or more delegation request statuses.
	Status *any `json:"status,omitempty"`
	// Id - Filter by delegation request ID or IDs.
	Id *any `json:"id,omitempty"`
	// ActorId - Filter by requester actor ID or IDs.
	ActorId *any `json:"actor_id,omitempty"`
	// IdentityId - Filter by identity ID or IDs.
	IdentityId *any `json:"identity_id,omitempty"`
}

// IdentitiesDelegationRequestsEndpointGetParams contains optional query parameters for Get.
type IdentitiesDelegationRequestsEndpointGetParams struct {
	// AllowDeleted - Return the request even if it has been deleted.
	AllowDeleted *bool `json:"allow_deleted,omitempty"`
}

// IdentitiesDelegationRequestsEndpointCreateBody contains the request body for Create.
type IdentitiesDelegationRequestsEndpointCreateBody struct {
	// IdentityId - Identity to request delegation for.
	IdentityId string `json:"identity_id"`
	// RequesterActorId - Actor requesting the delegation.
	RequesterActorId string `json:"requester_actor_id"`
	// DelegatorActorId - Actor submitting the request on behalf of the requester.
	DelegatorActorId *string `json:"delegator_actor_id,omitempty"`
	// Permissions - Permissions being requested.
	Permissions *[]string `json:"permissions,omitempty"`
	// ExpiresAt - Timestamp when the request should expire.
	ExpiresAt string `json:"expires_at"`
	// DelegationConfigId - Delegation config to use for the resulting delegation.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// CredentialOverrides - Optional per-credential permission overrides.
	CredentialOverrides *[]map[string]any `json:"credential_overrides,omitempty"`
	// Note - Optional human-readable note for the request.
	Note *string `json:"note,omitempty"`
	// Metadata - Additional metadata to store on the request.
	Metadata *map[string]any `json:"metadata,omitempty"`
}

// IdentitiesDelegationRequestsEndpointApproveParams contains optional query parameters for Approve.
type IdentitiesDelegationRequestsEndpointApproveParams struct {
	// AllowDeleted - Allow approving a request that is already deleted.
	AllowDeleted *bool `json:"allow_deleted,omitempty"`
}

// IdentitiesDelegationRequestsEndpointDenyParams contains optional query parameters for Deny.
type IdentitiesDelegationRequestsEndpointDenyParams struct {
	// AllowDeleted - Allow denying a request that is already deleted.
	AllowDeleted *bool `json:"allow_deleted,omitempty"`
}

// List returns a paginated list of identity delegation requests.
func (e *IdentitiesDelegationRequestsEndpoint) List(instanceId string, params *IdentitiesDelegationRequestsEndpointListParams) (*delegationrequests.IdentitiesDelegationRequestsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "identity-delegation-requests"},
		Query: query,
	}
	var result delegationrequests.IdentitiesDelegationRequestsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific identity delegation request by ID.
func (e *IdentitiesDelegationRequestsEndpoint) Get(instanceId string, identityDelegationRequestId string, params *IdentitiesDelegationRequestsEndpointGetParams) (*delegationrequests.IdentitiesDelegationRequestsGetOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "identity-delegation-requests", identityDelegationRequestId},
		Query: query,
	}
	var result delegationrequests.IdentitiesDelegationRequestsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new identity delegation request.
func (e *IdentitiesDelegationRequestsEndpoint) Create(instanceId string, body *IdentitiesDelegationRequestsEndpointCreateBody) (*delegationrequests.IdentitiesDelegationRequestsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"instances", instanceId, "identity-delegation-requests"},
		Body: body,
	}
	var result delegationrequests.IdentitiesDelegationRequestsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Approve approves an existing identity delegation request.
func (e *IdentitiesDelegationRequestsEndpoint) Approve(instanceId string, identityDelegationRequestId string, params *IdentitiesDelegationRequestsEndpointApproveParams) (*delegationrequests.IdentitiesDelegationRequestsApproveOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "identity-delegation-requests", identityDelegationRequestId, "approve"},
		Query: query,
	}
	var result delegationrequests.IdentitiesDelegationRequestsApproveOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Deny denies an existing identity delegation request.
func (e *IdentitiesDelegationRequestsEndpoint) Deny(instanceId string, identityDelegationRequestId string, params *IdentitiesDelegationRequestsEndpointDenyParams) (*delegationrequests.IdentitiesDelegationRequestsDenyOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"instances", instanceId, "identity-delegation-requests", identityDelegationRequestId, "deny"},
		Query: query,
	}
	var result delegationrequests.IdentitiesDelegationRequestsDenyOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
