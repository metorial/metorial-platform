package endpoints

import (
	"github.com/metorial/metorial-go/v1/internal/endpoint"
	"github.com/metorial/metorial-go/v1/resources/identities/credentials"
)

// IdentitiesCredentialsEndpoint provides access to identity credentials bind an identity to concrete provider deployment, config, and auth resources.
type IdentitiesCredentialsEndpoint struct {
	client *endpoint.Client
}

// NewIdentitiesCredentialsEndpoint creates a new IdentitiesCredentialsEndpoint.
func NewIdentitiesCredentialsEndpoint(client *endpoint.Client) *IdentitiesCredentialsEndpoint {
	return &IdentitiesCredentialsEndpoint{client: client}
}

// IdentitiesCredentialsEndpointListParams contains optional query parameters for List.
type IdentitiesCredentialsEndpointListParams struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
	// Status - Filter by one or more credential statuses.
	Status *any `json:"status,omitempty"`
	// Id - Filter by identity credential ID or IDs.
	Id *any `json:"id,omitempty"`
	// AgentId - Filter by owner agent ID or IDs.
	AgentId *any `json:"agent_id,omitempty"`
	// ActorId - Filter by owner actor ID or IDs.
	ActorId *any `json:"actor_id,omitempty"`
	// IdentityId - Filter by identity ID or IDs.
	IdentityId *any `json:"identity_id,omitempty"`
	// ProviderId - Filter by provider ID or IDs.
	ProviderId *any `json:"provider_id,omitempty"`
	// ProviderDeploymentId - Filter by provider deployment ID or IDs.
	ProviderDeploymentId *any `json:"provider_deployment_id,omitempty"`
	// ProviderConfigId - Filter by provider config ID or IDs.
	ProviderConfigId *any `json:"provider_config_id,omitempty"`
	// ProviderAuthConfigId - Filter by provider auth config ID or IDs.
	ProviderAuthConfigId *any `json:"provider_auth_config_id,omitempty"`
}

// IdentitiesCredentialsEndpointCreateBody contains the request body for Create.
type IdentitiesCredentialsEndpointCreateBody struct {
	// IdentityId - Identity that will own the new credential.
	IdentityId string `json:"identity_id"`
	// DeploymentId - Provider deployment to attach to the credential.
	DeploymentId *string `json:"deployment_id,omitempty"`
	// ConfigId - Provider config to attach to the credential.
	ConfigId *string `json:"config_id,omitempty"`
	// AuthConfigId - Provider auth config to attach to the credential.
	AuthConfigId *string `json:"auth_config_id,omitempty"`
	// DelegationConfigId - Delegation config to apply to the credential.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
}

// IdentitiesCredentialsEndpointUpdateBody contains the request body for Update.
type IdentitiesCredentialsEndpointUpdateBody struct {
	// DelegationConfigId - Delegation config to apply to the credential.
	DelegationConfigId string `json:"delegation_config_id"`
}

// List returns a paginated list of identity credentials for the instance.
func (e *IdentitiesCredentialsEndpoint) List(params *IdentitiesCredentialsEndpointListParams) (*credentials.IdentitiesCredentialsListOutput, error) {
	var query map[string]any
	if params != nil {
		query = endpoint.StructToQuery(params)
	}
	req := &endpoint.Request{
		Path:  []string{"identity-credentials"},
		Query: query,
	}
	var result credentials.IdentitiesCredentialsListOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Get retrieves a specific identity credential by ID.
func (e *IdentitiesCredentialsEndpoint) Get(identityCredentialId string) (*credentials.IdentitiesCredentialsGetOutput, error) {
	req := &endpoint.Request{
		Path: []string{"identity-credentials", identityCredentialId},
	}
	var result credentials.IdentitiesCredentialsGetOutput
	if err := e.client.Get(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Create creates a new credential and attaches it to an identity.
func (e *IdentitiesCredentialsEndpoint) Create(body *IdentitiesCredentialsEndpointCreateBody) (*credentials.IdentitiesCredentialsCreateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"identity-credentials"},
		Body: body,
	}
	var result credentials.IdentitiesCredentialsCreateOutput
	if err := e.client.Post(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update updates the delegation config attached to an identity credential.
func (e *IdentitiesCredentialsEndpoint) Update(identityCredentialId string, body *IdentitiesCredentialsEndpointUpdateBody) (*credentials.IdentitiesCredentialsUpdateOutput, error) {
	req := &endpoint.Request{
		Path: []string{"identity-credentials", identityCredentialId},
		Body: body,
	}
	var result credentials.IdentitiesCredentialsUpdateOutput
	if err := e.client.Patch(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete archives an identity credential.
func (e *IdentitiesCredentialsEndpoint) Delete(identityCredentialId string) (*credentials.IdentitiesCredentialsDeleteOutput, error) {
	req := &endpoint.Request{
		Path: []string{"identity-credentials", identityCredentialId},
	}
	var result credentials.IdentitiesCredentialsDeleteOutput
	if err := e.client.Delete(req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
