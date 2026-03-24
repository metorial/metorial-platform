package providergroups

import (
	"encoding/json"
	"time"
)

// ProviderGroupsUpdateOutput represents the provider groups update output type.
type ProviderGroupsUpdateOutput struct {
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

// MapProviderGroupsUpdateOutputFromJSON deserializes JSON data into a ProviderGroupsUpdateOutput.
func MapProviderGroupsUpdateOutputFromJSON(data []byte) (*ProviderGroupsUpdateOutput, error) {
	var v ProviderGroupsUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderGroupsUpdateOutputToJSON serializes a ProviderGroupsUpdateOutput to JSON.
func MapProviderGroupsUpdateOutputToJSON(v *ProviderGroupsUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderGroupsUpdateBody represents the provider groups update body type.
type ProviderGroupsUpdateBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

// MapProviderGroupsUpdateBodyFromJSON deserializes JSON data into a ProviderGroupsUpdateBody.
func MapProviderGroupsUpdateBodyFromJSON(data []byte) (*ProviderGroupsUpdateBody, error) {
	var v ProviderGroupsUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderGroupsUpdateBodyToJSON serializes a ProviderGroupsUpdateBody to JSON.
func MapProviderGroupsUpdateBodyToJSON(v *ProviderGroupsUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
