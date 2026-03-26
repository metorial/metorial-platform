package delegationconfigs

import (
	"encoding/json"
	"time"
)

// IdentitiesDelegationConfigsGetOutput represents the identities delegation configs get output type.
type IdentitiesDelegationConfigsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique delegation config identifier.
	Id string `json:"id"`
	// Status - Current lifecycle status of the delegation config.
	Status string `json:"status"`
	// IsDefault - Whether this config is the default config for the environment.
	IsDefault bool `json:"is_default"`
	// Name - Human-readable name of the delegation config.
	Name *string `json:"name,omitempty"`
	// Description - Optional description of the delegation policy.
	Description *string `json:"description,omitempty"`
	// Metadata - Additional metadata associated with the delegation config.
	Metadata *map[string]any `json:"metadata,omitempty"`
	// SubDelegationBehavior - How this config handles sub-delegation requests.
	SubDelegationBehavior string `json:"sub_delegation_behavior"`
	// SubDelegationDepth - Maximum allowed sub-delegation depth for this policy.
	SubDelegationDepth float64 `json:"sub_delegation_depth"`
	// CreatedAt - Timestamp when the delegation config was created.
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when the delegation config was last updated.
	UpdatedAt time.Time `json:"updated_at"`
}

// MapIdentitiesDelegationConfigsGetOutputFromJSON deserializes JSON data into a IdentitiesDelegationConfigsGetOutput.
func MapIdentitiesDelegationConfigsGetOutputFromJSON(data []byte) (*IdentitiesDelegationConfigsGetOutput, error) {
	var v IdentitiesDelegationConfigsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationConfigsGetOutputToJSON serializes a IdentitiesDelegationConfigsGetOutput to JSON.
func MapIdentitiesDelegationConfigsGetOutputToJSON(v *IdentitiesDelegationConfigsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
