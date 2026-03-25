package credentials

import (
	"encoding/json"
	"time"
)

// IdentitiesCredentialsDeleteOutput represents the identities credentials delete output type.
type IdentitiesCredentialsDeleteOutput struct {
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

// MapIdentitiesCredentialsDeleteOutputFromJSON deserializes JSON data into a IdentitiesCredentialsDeleteOutput.
func MapIdentitiesCredentialsDeleteOutputFromJSON(data []byte) (*IdentitiesCredentialsDeleteOutput, error) {
	var v IdentitiesCredentialsDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesCredentialsDeleteOutputToJSON serializes a IdentitiesCredentialsDeleteOutput to JSON.
func MapIdentitiesCredentialsDeleteOutputToJSON(v *IdentitiesCredentialsDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
