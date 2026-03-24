package portals

import (
	"encoding/json"
	"time"
)

// PortalsDeleteOutputAuth represents the portals delete output auth type.
type PortalsDeleteOutputAuth struct {
	Object                     string  `json:"object"`
	SessionExpiryTimeInSeconds float64 `json:"session_expiry_time_in_seconds"`
}

// PortalsDeleteOutputUrls represents the portals delete output urls type.
type PortalsDeleteOutputUrls struct {
	Type string `json:"type"`
	Url  string `json:"url"`
}

// PortalsDeleteOutputBrand represents the portals delete output brand type.
type PortalsDeleteOutputBrand struct {
	Image string `json:"image"`
	Name  string `json:"name"`
}

// PortalsDeleteOutput represents the portals delete output type.
type PortalsDeleteOutput struct {
	Object      string                    `json:"object"`
	Id          string                    `json:"id"`
	Status      string                    `json:"status"`
	Name        string                    `json:"name"`
	Slug        string                    `json:"slug"`
	Description *string                   `json:"description,omitempty"`
	Auth        PortalsDeleteOutputAuth   `json:"auth"`
	Urls        []PortalsDeleteOutputUrls `json:"urls"`
	Brand       PortalsDeleteOutputBrand  `json:"brand"`
	CreatedAt   time.Time                 `json:"created_at"`
	UpdatedAt   time.Time                 `json:"updated_at"`
}

// MapPortalsDeleteOutputFromJSON deserializes JSON data into a PortalsDeleteOutput.
func MapPortalsDeleteOutputFromJSON(data []byte) (*PortalsDeleteOutput, error) {
	var v PortalsDeleteOutput
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &v, nil
}

// MapPortalsDeleteOutputToJSON serializes a PortalsDeleteOutput to JSON.
func MapPortalsDeleteOutputToJSON(v *PortalsDeleteOutput) ([]byte, error) {
	return json.Marshal(v)
}
