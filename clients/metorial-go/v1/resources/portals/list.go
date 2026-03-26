package portals

import (
	"encoding/json"
	"time"
)

// PortalsListOutputItemsAuth represents the portals list output items auth type.
type PortalsListOutputItemsAuth struct {
	Object                     string  `json:"object"`
	SessionExpiryTimeInSeconds float64 `json:"session_expiry_time_in_seconds"`
}

// PortalsListOutputItemsUrls represents the portals list output items urls type.
type PortalsListOutputItemsUrls struct {
	Type string `json:"type"`
	Url  string `json:"url"`
}

// PortalsListOutputItemsBrand represents the portals list output items brand type.
type PortalsListOutputItemsBrand struct {
	Image string `json:"image"`
	Name  string `json:"name"`
}

// PortalsListOutputItems represents the portals list output items type.
type PortalsListOutputItems struct {
	Object      string                       `json:"object"`
	Id          string                       `json:"id"`
	Status      string                       `json:"status"`
	Name        string                       `json:"name"`
	Slug        string                       `json:"slug"`
	Description *string                      `json:"description,omitempty"`
	Auth        PortalsListOutputItemsAuth   `json:"auth"`
	Urls        []PortalsListOutputItemsUrls `json:"urls"`
	Brand       PortalsListOutputItemsBrand  `json:"brand"`
	CreatedAt   time.Time                    `json:"created_at"`
	UpdatedAt   time.Time                    `json:"updated_at"`
}

// PortalsListOutputPagination represents the portals list output pagination type.
type PortalsListOutputPagination struct {
	HasMoreBefore bool `json:"has_more_before"`
	HasMoreAfter  bool `json:"has_more_after"`
}

// PortalsListOutput represents the portals list output type.
type PortalsListOutput struct {
	Items      []PortalsListOutputItems    `json:"items"`
	Pagination PortalsListOutputPagination `json:"pagination"`
}

// MapPortalsListOutputFromJSON deserializes JSON data into a PortalsListOutput.
func MapPortalsListOutputFromJSON(data []byte) (*PortalsListOutput, error) {
	var v PortalsListOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapPortalsListOutputToJSON serializes a PortalsListOutput to JSON.
func MapPortalsListOutputToJSON(v *PortalsListOutput) ([]byte, error) {
	return json.Marshal(v)
}

// PortalsListQuery represents the portals list query type.
type PortalsListQuery struct {
	Limit  *float64 `json:"limit,omitempty"`
	After  *string  `json:"after,omitempty"`
	Before *string  `json:"before,omitempty"`
	Cursor *string  `json:"cursor,omitempty"`
	Order  *string  `json:"order,omitempty"`
}

// MapPortalsListQueryFromJSON deserializes JSON data into a PortalsListQuery.
func MapPortalsListQueryFromJSON(data []byte) (*PortalsListQuery, error) {
	var v PortalsListQuery
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapPortalsListQueryToJSON serializes a PortalsListQuery to JSON.
func MapPortalsListQueryToJSON(v *PortalsListQuery) ([]byte, error) {
	return json.Marshal(v)
}
