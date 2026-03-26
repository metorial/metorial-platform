package publishers

import (
	"encoding/json"
	"time"
)

// PublishersGetOutput represents the publishers get output type.
type PublishersGetOutput struct {
	// Object - String representing the object's type
	Object string `json:"object"`
	// Id - Unique publisher identifier
	Id string `json:"id"`
	// Name - Display name of the publisher
	Name string `json:"name"`
	// Description - Brief description of the publisher
	Description *string `json:"description,omitempty"`
	// ImageUrl - URL of the publisher logo
	ImageUrl string `json:"image_url"`
	// CreatedAt - Timestamp when created
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt - Timestamp when last updated
	UpdatedAt time.Time `json:"updated_at"`
}

// MapPublishersGetOutputFromJSON deserializes JSON data into a PublishersGetOutput.
func MapPublishersGetOutputFromJSON(data []byte) (*PublishersGetOutput, error) {
	var v PublishersGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapPublishersGetOutputToJSON serializes a PublishersGetOutput to JSON.
func MapPublishersGetOutputToJSON(v *PublishersGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
