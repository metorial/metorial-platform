package portals

import (
	"encoding/json"
	"time"
)

// PortalsGetOutputAuth represents the portals get output auth type.
type PortalsGetOutputAuth struct {
	Object                     string  `json:"object"`
	SessionExpiryTimeInSeconds float64 `json:"session_expiry_time_in_seconds"`
}

// PortalsGetOutputUrls represents the portals get output urls type.
type PortalsGetOutputUrls struct {
	Type string `json:"type"`
	Url  string `json:"url"`
}

// PortalsGetOutputBrand represents the portals get output brand type.
type PortalsGetOutputBrand struct {
	Image string `json:"image"`
	Name  string `json:"name"`
}

// PortalsGetOutput represents the portals get output type.
type PortalsGetOutput struct {
	Object      string                 `json:"object"`
	Id          string                 `json:"id"`
	Status      string                 `json:"status"`
	Name        string                 `json:"name"`
	Slug        string                 `json:"slug"`
	Description *string                `json:"description,omitempty"`
	Auth        PortalsGetOutputAuth   `json:"auth"`
	Urls        []PortalsGetOutputUrls `json:"urls"`
	Brand       PortalsGetOutputBrand  `json:"brand"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// MapPortalsGetOutputFromJSON deserializes JSON data into a PortalsGetOutput.
func MapPortalsGetOutputFromJSON(data []byte) (*PortalsGetOutput, error) {
	var v PortalsGetOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapPortalsGetOutputToJSON serializes a PortalsGetOutput to JSON.
func MapPortalsGetOutputToJSON(v *PortalsGetOutput) ([]byte, error) {
	return json.Marshal(v)
}
