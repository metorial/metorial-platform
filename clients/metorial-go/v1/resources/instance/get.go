package instance

import (
	"encoding/json"
	"time"
)

// InstanceGetOutputProject represents the instance get output project type.
type InstanceGetOutputProject struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - The project's unique identifier
	Id string `json:"id"`
	// Status - The project's status
	Status string `json:"status"`
	// Slug - The project's slug
	Slug string `json:"slug"`
	// Name - The project's name
	Name string `json:"name"`
	// OrganizationId - The organization's unique identifier
	OrganizationId string `json:"organization_id"`
	// CreatedAt - The project's creation date
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - The project's last update date
	UpdatedAt time.Time `json:"updated_at"`
}

// InstanceGetOutput represents the instance get output type.
type InstanceGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - The instance's unique identifier
	Id string `json:"id"`
	// Slug - The instance's slug
	Slug string `json:"slug"`
	// Name - The instance's name
	Name string `json:"name"`
	// OrganizationId - The organization's unique identifier
	OrganizationId string `json:"organization_id"`
	// Type - The instance's type
	Type string `json:"type"`
	// CreatedAt - The instance's creation date
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - The instance's last update date
	UpdatedAt time.Time                `json:"updated_at"`
	Project   InstanceGetOutputProject `json:"project"`
}

// MapInstanceGetOutputFromJSON deserializes JSON data into a InstanceGetOutput.
func MapInstanceGetOutputFromJSON(data []byte) (*InstanceGetOutput, error) {
	var v InstanceGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapInstanceGetOutputToJSON serializes a InstanceGetOutput to JSON.
func MapInstanceGetOutputToJSON(v *InstanceGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
