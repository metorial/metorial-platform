package providergroups

import (
	"encoding/json"
	"time"
)

// ProviderGroupsRemoveListingOutput represents the provider groups remove listing output type.
type ProviderGroupsRemoveListingOutput struct {
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

// MapProviderGroupsRemoveListingOutputFromJSON deserializes JSON data into a ProviderGroupsRemoveListingOutput.
func MapProviderGroupsRemoveListingOutputFromJSON(data []byte) (*ProviderGroupsRemoveListingOutput, error) {
	var v ProviderGroupsRemoveListingOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderGroupsRemoveListingOutputToJSON serializes a ProviderGroupsRemoveListingOutput to JSON.
func MapProviderGroupsRemoveListingOutputToJSON(v *ProviderGroupsRemoveListingOutput) ([]byte, error) {
	return json.Marshal(v)
}
