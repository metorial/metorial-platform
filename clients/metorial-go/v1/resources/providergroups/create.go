package providergroups

import (
	"encoding/json"
	"time"
)

// ProviderGroupsCreateOutput represents the provider groups create output type.
type ProviderGroupsCreateOutput struct {
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

// MapProviderGroupsCreateOutputFromJSON deserializes JSON data into a ProviderGroupsCreateOutput.
func MapProviderGroupsCreateOutputFromJSON(data []byte) (*ProviderGroupsCreateOutput, error) {
	var v ProviderGroupsCreateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderGroupsCreateOutputToJSON serializes a ProviderGroupsCreateOutput to JSON.
func MapProviderGroupsCreateOutputToJSON(v *ProviderGroupsCreateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// ProviderGroupsCreateBody represents the provider groups create body type.
type ProviderGroupsCreateBody struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

// MapProviderGroupsCreateBodyFromJSON deserializes JSON data into a ProviderGroupsCreateBody.
func MapProviderGroupsCreateBodyFromJSON(data []byte) (*ProviderGroupsCreateBody, error) {
	var v ProviderGroupsCreateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderGroupsCreateBodyToJSON serializes a ProviderGroupsCreateBody to JSON.
func MapProviderGroupsCreateBodyToJSON(v *ProviderGroupsCreateBody) ([]byte, error) {
	return json.Marshal(v)
}
