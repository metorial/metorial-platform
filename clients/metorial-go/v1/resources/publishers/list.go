package publishers

import (
	"encoding/json"
	"time"
)

// PublishersListOutputItems represents the publishers list output items type.
type PublishersListOutputItems struct {
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

// PublishersListOutputPagination represents the publishers list output pagination type.
type PublishersListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// PublishersListOutput represents the publishers list output type.
type PublishersListOutput struct {
	Items      []PublishersListOutputItems    `json:"items"`
	Pagination PublishersListOutputPagination `json:"pagination"`
}

// MapPublishersListOutputFromJSON deserializes JSON data into a PublishersListOutput.
func MapPublishersListOutputFromJSON(data []byte) (*PublishersListOutput, error) {
	var v PublishersListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapPublishersListOutputToJSON serializes a PublishersListOutput to JSON.
func MapPublishersListOutputToJSON(v *PublishersListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// PublishersListQuery represents the publishers list query type.
type PublishersListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
}

// MapPublishersListQueryFromJSON deserializes JSON data into a PublishersListQuery.
func MapPublishersListQueryFromJSON(data []byte) (*PublishersListQuery, error) {
	var v PublishersListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapPublishersListQueryToJSON serializes a PublishersListQuery to JSON.
func MapPublishersListQueryToJSON(v *PublishersListQuery) ([]byte, error) {
	return json.Marshal(v)
}
