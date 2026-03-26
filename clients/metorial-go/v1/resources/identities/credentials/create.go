package credentials

import (
	"encoding/json"
	"time"
)

// IdentitiesCredentialsCreateOutput represents the identities credentials create output type.
type IdentitiesCredentialsCreateOutput struct {
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

// MapIdentitiesCredentialsCreateOutputFromJSON deserializes JSON data into a IdentitiesCredentialsCreateOutput.
func MapIdentitiesCredentialsCreateOutputFromJSON(data []byte) (*IdentitiesCredentialsCreateOutput, error) {
	var v IdentitiesCredentialsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesCredentialsCreateOutputToJSON serializes a IdentitiesCredentialsCreateOutput to JSON.
func MapIdentitiesCredentialsCreateOutputToJSON(v *IdentitiesCredentialsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesCredentialsCreateBody represents the identities credentials create body type.
type IdentitiesCredentialsCreateBody struct {
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

// MapIdentitiesCredentialsCreateBodyFromJSON deserializes JSON data into a IdentitiesCredentialsCreateBody.
func MapIdentitiesCredentialsCreateBodyFromJSON(data []byte) (*IdentitiesCredentialsCreateBody, error) {
	var v IdentitiesCredentialsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesCredentialsCreateBodyToJSON serializes a IdentitiesCredentialsCreateBody to JSON.
func MapIdentitiesCredentialsCreateBodyToJSON(v *IdentitiesCredentialsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
