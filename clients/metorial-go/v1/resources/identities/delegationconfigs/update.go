package delegationconfigs

import (
	"encoding/json"
	"time"
)

// IdentitiesDelegationConfigsUpdateOutput represents the identities delegation configs update output type.
type IdentitiesDelegationConfigsUpdateOutput struct {
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

// MapIdentitiesDelegationConfigsUpdateOutputFromJSON deserializes JSON data into a IdentitiesDelegationConfigsUpdateOutput.
func MapIdentitiesDelegationConfigsUpdateOutputFromJSON(data []byte) (*IdentitiesDelegationConfigsUpdateOutput, error) {
	var v IdentitiesDelegationConfigsUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationConfigsUpdateOutputToJSON serializes a IdentitiesDelegationConfigsUpdateOutput to JSON.
func MapIdentitiesDelegationConfigsUpdateOutputToJSON(v *IdentitiesDelegationConfigsUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesDelegationConfigsUpdateBody represents the identities delegation configs update body type.
type IdentitiesDelegationConfigsUpdateBody struct {
	// Name - Updated display name for the delegation config.
	Name *string `json:"name,omitempty"`
	// Description - Updated description for the delegation config.
	Description *string `json:"description,omitempty"`
	// Metadata - Updated metadata for the delegation config.
	Metadata *map[string]any `json:"metadata,omitempty"`
	// SubDelegationBehavior - How sub-delegations should be handled.
	SubDelegationBehavior *string `json:"sub_delegation_behavior,omitempty"`
	// SubDelegationDepth - Maximum allowed sub-delegation depth.
	SubDelegationDepth *float64 `json:"sub_delegation_depth,omitempty"`
}

// MapIdentitiesDelegationConfigsUpdateBodyFromJSON deserializes JSON data into a IdentitiesDelegationConfigsUpdateBody.
func MapIdentitiesDelegationConfigsUpdateBodyFromJSON(data []byte) (*IdentitiesDelegationConfigsUpdateBody, error) {
	var v IdentitiesDelegationConfigsUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationConfigsUpdateBodyToJSON serializes a IdentitiesDelegationConfigsUpdateBody to JSON.
func MapIdentitiesDelegationConfigsUpdateBodyToJSON(v *IdentitiesDelegationConfigsUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
