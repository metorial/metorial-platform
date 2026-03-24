package delegationconfigs

import (
	"encoding/json"
	"time"
)

// IdentitiesDelegationConfigsCreateOutput represents the identities delegation configs create output type.
type IdentitiesDelegationConfigsCreateOutput struct {
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

// MapIdentitiesDelegationConfigsCreateOutputFromJSON deserializes JSON data into a IdentitiesDelegationConfigsCreateOutput.
func MapIdentitiesDelegationConfigsCreateOutputFromJSON(data []byte) (*IdentitiesDelegationConfigsCreateOutput, error) {
	var v IdentitiesDelegationConfigsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationConfigsCreateOutputToJSON serializes a IdentitiesDelegationConfigsCreateOutput to JSON.
func MapIdentitiesDelegationConfigsCreateOutputToJSON(v *IdentitiesDelegationConfigsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// IdentitiesDelegationConfigsCreateBody represents the identities delegation configs create body type.
type IdentitiesDelegationConfigsCreateBody struct {
	// Name - Optional display name for the delegation config.
	Name *string `json:"name,omitempty"`
	// Description - Optional description of the delegation policy.
	Description *string `json:"description,omitempty"`
	// Metadata - Additional metadata to store on the delegation config.
	Metadata *map[string]any `json:"metadata,omitempty"`
	// SubDelegationBehavior - How sub-delegations should be handled.
	SubDelegationBehavior string `json:"sub_delegation_behavior"`
	// SubDelegationDepth - Maximum allowed sub-delegation depth.
	SubDelegationDepth *float64 `json:"sub_delegation_depth,omitempty"`
}

// MapIdentitiesDelegationConfigsCreateBodyFromJSON deserializes JSON data into a IdentitiesDelegationConfigsCreateBody.
func MapIdentitiesDelegationConfigsCreateBodyFromJSON(data []byte) (*IdentitiesDelegationConfigsCreateBody, error) {
	var v IdentitiesDelegationConfigsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapIdentitiesDelegationConfigsCreateBodyToJSON serializes a IdentitiesDelegationConfigsCreateBody to JSON.
func MapIdentitiesDelegationConfigsCreateBodyToJSON(v *IdentitiesDelegationConfigsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
