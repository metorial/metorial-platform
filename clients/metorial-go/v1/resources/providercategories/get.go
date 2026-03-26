package providercategories

import (
	"encoding/json"
	"time"
)

// ProviderCategoriesGetOutput represents the provider categories get output type.
type ProviderCategoriesGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique category identifier
	Id string `json:"id"`
	// Name - Display name of the category
	Name string `json:"name"`
	// Description - Description of providers in this category
	Description string `json:"description"`
	// Slug - URL-friendly identifier
	Slug string `json:"slug"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapProviderCategoriesGetOutputFromJSON deserializes JSON data into a ProviderCategoriesGetOutput.
func MapProviderCategoriesGetOutputFromJSON(data []byte) (*ProviderCategoriesGetOutput, error) {
	var v ProviderCategoriesGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapProviderCategoriesGetOutputToJSON serializes a ProviderCategoriesGetOutput to JSON.
func MapProviderCategoriesGetOutputToJSON(v *ProviderCategoriesGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
