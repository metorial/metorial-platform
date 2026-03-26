package credentials

import (
	"encoding/json"
	"time"
)

// IdentitiesCredentialsListOutputItems represents the identities credentials list output items type.
type IdentitiesCredentialsListOutputItems struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique identity credential identifier.
	Id string `json:"id"`
	// Status - Current lifecycle status of the credential.
	Status string `json:"status"`
	// IdentityId - Identity that owns this credential.
	IdentityId string `json:"identity_id"`
	// ProviderId - Provider associated with the credential.
	ProviderId string `json:"provider_id"`
	// DeploymentId - Provider deployment used by this credential.
	DeploymentId *string `json:"deployment_id,omitempty"`
	// ConfigId - Provider config used by this credential.
	ConfigId *string `json:"config_id,omitempty"`
	// AuthConfigId - Provider auth config used by this credential.
	AuthConfigId *string `json:"auth_config_id,omitempty"`
	// DelegationConfigId - Delegation config applied to this credential.
	DelegationConfigId *string `json:"delegation_config_id,omitempty"`
	// CreatedAt - Timestamp when the credential was created.
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the credential was last updated.
	UpdatedAt time.Time `json:"updated_at"`
}

// IdentitiesCredentialsListOutputPagination represents the identities credentials list output pagination type.
type IdentitiesCredentialsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// IdentitiesCredentialsListOutput represents the identities credentials list output type.
type IdentitiesCredentialsListOutput struct {
	Items      []IdentitiesCredentialsListOutputItems    `json:"items"`
	Pagination IdentitiesCredentialsListOutputPagination `json:"pagination"`
}

// MapIdentitiesCredentialsListOutputFromJSON deserializes JSON data into a IdentitiesCredentialsListOutput.
func MapIdentitiesCredentialsListOutputFromJSON(data []byte) (*IdentitiesCredentialsListOutput, error) {
	var v IdentitiesCredentialsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesCredentialsListOutputToJSON serializes a IdentitiesCredentialsListOutput to JSON.
func MapIdentitiesCredentialsListOutputToJSON(v *IdentitiesCredentialsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesCredentialsListQuery represents the identities credentials list query type.
type IdentitiesCredentialsListQuery struct {
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

// MapIdentitiesCredentialsListQueryFromJSON deserializes JSON data into a IdentitiesCredentialsListQuery.
func MapIdentitiesCredentialsListQueryFromJSON(data []byte) (*IdentitiesCredentialsListQuery, error) {
	var v IdentitiesCredentialsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesCredentialsListQueryToJSON serializes a IdentitiesCredentialsListQuery to JSON.
func MapIdentitiesCredentialsListQueryToJSON(v *IdentitiesCredentialsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
