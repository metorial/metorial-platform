package providercollections

import (
	"encoding/json"
	"time"
)

// ProviderCollectionsGetOutput represents the provider collections get output type.
type ProviderCollectionsGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique collection identifier
	Id string `json:"id"`
	// Name - Display name of the collection
	Name string `json:"name"`
	// Description - Description of the collection
	Description string `json:"description"`
	// Slug - URL-friendly identifier
	Slug string `json:"slug"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderCollectionsGetOutputFromJSON deserializes JSON data into a ProviderCollectionsGetOutput.
func MapProviderCollectionsGetOutputFromJSON(data []byte) (*ProviderCollectionsGetOutput, error) {
	var v ProviderCollectionsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderCollectionsGetOutputToJSON serializes a ProviderCollectionsGetOutput to JSON.
func MapProviderCollectionsGetOutputToJSON(v *ProviderCollectionsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
