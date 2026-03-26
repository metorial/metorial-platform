package delegationconfigs

import (
	"encoding/json"
	"time"
)

// IdentitiesDelegationConfigsDeleteOutput represents the identities delegation configs delete output type.
type IdentitiesDelegationConfigsDeleteOutput struct {
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

// MapIdentitiesDelegationConfigsDeleteOutputFromJSON deserializes JSON data into a IdentitiesDelegationConfigsDeleteOutput.
func MapIdentitiesDelegationConfigsDeleteOutputFromJSON(data []byte) (*IdentitiesDelegationConfigsDeleteOutput, error) {
	var v IdentitiesDelegationConfigsDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationConfigsDeleteOutputToJSON serializes a IdentitiesDelegationConfigsDeleteOutput to JSON.
func MapIdentitiesDelegationConfigsDeleteOutputToJSON(v *IdentitiesDelegationConfigsDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
