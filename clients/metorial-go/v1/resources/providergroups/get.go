package providergroups

import (
	"encoding/json"
	"time"
)

// ProviderGroupsGetOutput represents the provider groups get output type.
type ProviderGroupsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique group identifier
	Id string `json:"id"`
	// Name - Display name of the group
	Name string `json:"name"`
	// Description - Description of the group
	Description *string `json:"description,omitempty"`
	// Slug - URL-friendly identifier
	Slug string `json:"slug"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderGroupsGetOutputFromJSON deserializes JSON data into a ProviderGroupsGetOutput.
func MapProviderGroupsGetOutputFromJSON(data []byte) (*ProviderGroupsGetOutput, error) {
	var v ProviderGroupsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderGroupsGetOutputToJSON serializes a ProviderGroupsGetOutput to JSON.
func MapProviderGroupsGetOutputToJSON(v *ProviderGroupsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
