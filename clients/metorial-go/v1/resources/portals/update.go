package portals

import (
	"encoding/json"
	"time"
)

// PortalsUpdateOutputAuth represents the portals update output auth type.
type PortalsUpdateOutputAuth struct {
	Object                     string  `json:"object"`
	SessionExpiryTimeInSeconds float64 `json:"session_expiry_time_in_seconds"`
}

// PortalsUpdateOutputUrls represents the portals update output urls type.
type PortalsUpdateOutputUrls struct {
	Type string `json:"type"`
	Url  string `json:"url"`
}

// PortalsUpdateOutputBrand represents the portals update output brand type.
type PortalsUpdateOutputBrand struct {
	Image string `json:"image"`
	Name  string `json:"name"`
}

// PortalsUpdateOutput represents the portals update output type.
type PortalsUpdateOutput struct {
	Object      string                    `json:"object"`
	Id          string                    `json:"id"`
	Status      string                    `json:"status"`
	Name        string                    `json:"name"`
	Slug        string                    `json:"slug"`
	Description *string                   `json:"description,omitempty"`
	Auth        PortalsUpdateOutputAuth   `json:"auth"`
	Urls        []PortalsUpdateOutputUrls `json:"urls"`
	Brand       PortalsUpdateOutputBrand  `json:"brand"`
	CreatedAt   time.Time                 `json:"created_at"`
	UpdatedAt   time.Time                 `json:"updated_at"`
}

// MapPortalsUpdateOutputFromJSON deserializes JSON data into a PortalsUpdateOutput.
func MapPortalsUpdateOutputFromJSON(data []byte) (*PortalsUpdateOutput, error) {
	var v PortalsUpdateOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapPortalsUpdateOutputToJSON serializes a PortalsUpdateOutput to JSON.
func MapPortalsUpdateOutputToJSON(v *PortalsUpdateOutput) ([]byte, error) {
	return json.Marshal(v)
}

// PortalsUpdateBody represents the portals update body type.
type PortalsUpdateBody struct {
	Name                       *string  `json:"name,omitempty"`
	Description                *string  `json:"description,omitempty"`
	SessionExpiryTimeInSeconds *float64 `json:"session_expiry_time_in_seconds,omitempty"`
}

// MapPortalsUpdateBodyFromJSON deserializes JSON data into a PortalsUpdateBody.
func MapPortalsUpdateBodyFromJSON(data []byte) (*PortalsUpdateBody, error) {
	var v PortalsUpdateBody
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapPortalsUpdateBodyToJSON serializes a PortalsUpdateBody to JSON.
func MapPortalsUpdateBodyToJSON(v *PortalsUpdateBody) ([]byte, error) {
	return json.Marshal(v)
}
